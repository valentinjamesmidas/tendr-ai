import type { D1Database, RateLimit } from '@cloudflare/workers-types';
import { analysisCreditPriceMinor, plans, singleOfferPriceMinor, subscriptionRequestSchema } from '../packages/schemas/src/index';
import { getCustomer } from './customer-account';
import { readBounded } from './nen-files';

const reply = (body:object,status:number) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function handlePurchaseRequest(request:Request, db:D1Database, rateLimit:RateLimit) {
 if(request.method!=='POST')return reply({message:'Poptávku odešlete přes formulář.'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({message:'Požadavek musí přijít z tendr.ai.'},403);
 if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return reply({message:'Formulář musí být ve formátu JSON.'},415);
 const quota=await rateLimit.limit({key:`purchase:${request.headers.get('CF-Connecting-IP')??'local'}`});
 if(!quota.success)return reply({message:'Zkuste poptávku poslat za chvíli znovu.'},429);
 let form;
 try {
  const body=new TextDecoder().decode(await readBounded(request.body,2_048));
  form=subscriptionRequestSchema.parse(JSON.parse(body));
 } catch {
  return reply({message:'Zkontrolujte údaje poptávky a e-mail.'},400);
 }
 const {requestId,selection,email,company}=form;
 try {
  const account=await getCustomer(request,db);
  if(!account&&selection.plan!=='enterprise')return reply({message:'Před odesláním poptávky se přihlaste.'},401);
  const id=account?.id??null;
  const amount=selection.plan==='credit'?analysisCreditPriceMinor:selection.plan==='offer'?singleOfferPriceMinor
   : selection.plan==='business'?(selection.billing==='annual'?plans.business.annualMinor:plans.business.monthlyMinor)
   : selection.plan==='pro'?plans.pro.monthlyMinor:null;
  await db.prepare(`INSERT INTO customer_purchase_requests (id,account_id,product,billing,reference,email,company,price_minor)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
   .bind(requestId,id,selection.plan,selection.billing,selection.plan==='offer'?selection.reference:null,email,company,amount).run();
  return reply({requestId},201);
 } catch {
  return reply({message:'Poptávku se nepodařilo uložit. Zkuste to znovu.'},503);
 }
}
