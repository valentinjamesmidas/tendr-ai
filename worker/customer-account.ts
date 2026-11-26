import type { D1Database, RateLimit } from '@cloudflare/workers-types';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { readBounded } from './nen-files';

const sessionCookie = '__Host-tendr_session';
const sessionLifetime = 7 * 86_400;
const holdLifetime = 12 * 60;
const dummySalt = '0'.repeat(32);
// OWASP's scrypt work factor with a 16 MiB memory budget for the Worker.
const scryptOptions = { N:2**14, r:8, p:5, maxmem:32 * 1024 * 1024 };
const credentials = {
 email:z.string().trim().max(254).pipe(z.email()).transform(value=>value.toLowerCase()),
 password:z.string().min(12).max(128),
};
const accountAction = z.discriminatedUnion('action',[
 z.object({action:z.enum(['register','login']),...credentials}).strict(),
 z.object({action:z.literal('logout')}).strict(),
]);

export interface Customer {
 id:string;
 email:string;
 credits:number;
}

function json(data:unknown,status=200,cookie?:string) {
 const headers = new Headers({'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'});
 if (cookie) headers.set('Set-Cookie',cookie);
 return Response.json(data,{status,headers});
}

function cookieValue(token:string,age:number) {
 return `${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}

async function sessionHash(request:Request) {
 const match = /(?:^|;\s*)__Host-tendr_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(request.headers.get('Cookie')??'');
 return match ? hashToken(match[1]) : null;
}

function hashToken(token:string):Promise<string> {
 return crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)).then(value=>Buffer.from(value).toString('hex'));
}

function passwordHash(password:string,salt:string):Promise<Buffer> {
 return new Promise((resolve,reject)=>{
  scrypt(password,salt,32,scryptOptions,(error,digest)=>error ? reject(error) : resolve(digest));
 });
}

export async function getCustomer(request:Request,db:D1Database):Promise<Customer|null> {
 const token = await sessionHash(request);
 if (!token) return null;
 return db.prepare(`SELECT a.id, a.email, a.credits - (
  SELECT count(*) FROM customer_credit_reservations r
  WHERE r.account_id = a.id AND r.status = 'reserved' AND r.expires_at > unixepoch()
 ) AS credits
 FROM customer_sessions s JOIN customer_accounts a ON a.id = s.account_id
 WHERE s.token_hash = ?1 AND s.expires_at > unixepoch()`)
  .bind(token).first<Customer>();
}

export async function reserveCustomerCredit(accountId:string,db:D1Database):Promise<string|null> {
 const id = crypto.randomUUID();
 const [,reservation] = await db.batch([
  db.prepare(`DELETE FROM customer_credit_reservations
   WHERE account_id = ?1 AND status = 'reserved' AND expires_at <= unixepoch()`).bind(accountId),
  db.prepare(`INSERT INTO customer_credit_reservations (id, account_id, expires_at)
   SELECT ?1, a.id, unixepoch() + ?2 FROM customer_accounts a
   WHERE a.id = ?3 AND a.credits > (
    SELECT count(*) FROM customer_credit_reservations r
    WHERE r.account_id = a.id AND r.status = 'reserved' AND r.expires_at > unixepoch()
   )`).bind(id,holdLifetime,accountId),
 ]);
 return reservation.meta.changes===1 ? id : null;
}

export async function settleCustomerCredit(accountId:string,reservationId:string,consume:boolean,db:D1Database):Promise<void> {
 if (!consume) {
  await db.prepare(`DELETE FROM customer_credit_reservations
   WHERE account_id = ?1 AND id = ?2 AND status = 'reserved'`).bind(accountId,reservationId).run();
  return;
 }
 const [,reservation] = await db.batch<{status:'consumed'|'reserved'}>([
  db.prepare(`UPDATE customer_credit_reservations SET status = 'consumed'
   WHERE account_id = ?1 AND id = ?2 AND status = 'reserved' AND expires_at > unixepoch()`).bind(accountId,reservationId),
  db.prepare('SELECT status FROM customer_credit_reservations WHERE account_id = ?1 AND id = ?2').bind(accountId,reservationId),
 ]);
 if (reservation.results[0]?.status!=='consumed') throw new Error('Credit hold has expired');
}

async function issueSession(request:Request,accountId:string,db:D1Database):Promise<Response> {
 const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
 const [digest,previous] = await Promise.all([hashToken(token),sessionHash(request)]);
 await db.batch([
  db.prepare('DELETE FROM customer_sessions WHERE expires_at <= unixepoch() OR token_hash = ?1').bind(previous),
  db.prepare('INSERT INTO customer_sessions (token_hash, account_id, expires_at) VALUES (?1, ?2, unixepoch() + ?3)')
   .bind(digest,accountId,sessionLifetime),
 ]);
 const authenticated = new Request(request.url,{headers:{Cookie:`${sessionCookie}=${token}`}});
 return json({customer:await getCustomer(authenticated,db)},200,cookieValue(token,sessionLifetime));
}

export async function handleCustomerAccount(request:Request,db:D1Database,rateLimit:RateLimit):Promise<Response> {
 try {
  if (request.method==='GET') return json({customer:await getCustomer(request,db)});
  if (request.method!=='POST') return json({message:'Použijte formulář účtu.'},405);
  if (request.headers.get('Origin')!==new URL(request.url).origin) return json({message:'Požadavek musí přijít z tendr.ai.'},403);
  if (request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')
   return json({message:'Použijte formulář účtu.'},415);
  const quota = await rateLimit.limit({key:request.headers.get('CF-Connecting-IP')??'local'});
  if (!quota.success) return json({message:'Příliš mnoho pokusů. Zkuste to za chvíli.'},429);
  let input:z.infer<typeof accountAction>;
  try {
   const body = new TextDecoder().decode(await readBounded(request.body,2048));
   input = accountAction.parse(JSON.parse(body));
  } catch {
   return json({message:'Zkontrolujte e-mail a heslo o délce alespoň 12 znaků.'},400);
  }
  if (input.action==='logout') {
   const token = await sessionHash(request);
   if (token) await db.prepare('DELETE FROM customer_sessions WHERE token_hash = ?1').bind(token).run();
   return json({customer:null},200,cookieValue('',0));
  }
  if (input.action==='register') {
   const id = crypto.randomUUID();
   const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');
   const digest = await passwordHash(input.password,salt);
   const account = await db.prepare(`INSERT INTO customer_accounts (id, email, password_salt, password_hash)
    VALUES (?1, ?2, ?3, ?4) ON CONFLICT(email) DO NOTHING RETURNING id`)
    .bind(id,input.email,salt,digest.toString('hex')).first<{id:string}>();
   if (!account) return json({message:'Účet se nepodařilo vytvořit. Pokud ho už máte, přihlaste se.'},409);
   return await issueSession(request,account.id,db);
  }
  const account = await db.prepare('SELECT id, password_salt, password_hash FROM customer_accounts WHERE email = ?1')
   .bind(input.email).first<{id:string; password_salt:string; password_hash:string}>();
  const digest = await passwordHash(input.password,account?.password_salt??dummySalt);
  const valid = timingSafeEqual(digest,Buffer.from(account?.password_hash??'0'.repeat(64),'hex'));
  if (!account||!valid) return json({message:'E-mail nebo heslo nesouhlasí.'},401);
  return await issueSession(request,account.id,db);
 } catch {
  return json({message:'Účet se nepodařilo načíst. Zkuste to za chvíli.'},503);
 }
}
