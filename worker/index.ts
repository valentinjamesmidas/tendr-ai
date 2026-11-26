import type { Ai, D1Database, ExecutionContext, RateLimit } from '@cloudflare/workers-types';
import { z } from 'zod';
import { referenceSchema, type NenAnalysisEvent } from '../packages/schemas/src/index';
import { analyzeNen, NenSourceError } from './nen-analysis';
import { readBounded } from './nen-files';
import { getProfileSettings } from './nen-official';
import { lookupPublicIndex, readPublicIndexMeta } from './nen-public-index';
import { getCustomer, handleCustomerAccount, reserveCustomerCredit, settleCustomerCredit } from './customer-account';
import { handlePurchaseRequest } from './purchase-requests';

interface Bindings {
 ASSETS: {fetch(request:Request):Promise<Response>};
 AI?: Ai;
 NEN_RATE_LIMIT?: RateLimit;
 CUSTOMERS?: D1Database;
 CUSTOMER_RATE_LIMIT?: RateLimit;
 NEN_SOURCE_URL?: string;
 NEN_SOURCE_TOKEN?: string;
 NEN_DOCUMENT_ORIGINS?: string;
 NEN_PUBLIC_INDEX?: string;
 NEN_PROFILE_SOURCES?: string;
}
const inputSchema = z.object({reference:referenceSchema}).strict();
const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function errorResponse(status:number,message:string) {
 return Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
}

async function handleAnalysis(request:Request, env:Bindings, ctx:Pick<ExecutionContext,'waitUntil'>) {
 const requestUrl=new URL(request.url);
 const profiles=getProfileSettings(env.NEN_PROFILE_SOURCES);
 const indexEnabled=env.NEN_PUBLIC_INDEX==='enabled';
 const available=Boolean((env.NEN_SOURCE_URL||profiles.length||indexEnabled)&&env.AI&&env.NEN_RATE_LIMIT&&env.CUSTOMERS);
 if (request.method === 'GET') {
  const meta=indexEnabled&&!env.NEN_SOURCE_URL ? await readPublicIndexMeta(env.ASSETS,requestUrl.origin).catch(()=>undefined) : undefined;
  return Response.json({available,coverage:meta},{headers:{'Cache-Control':'no-store'}});
 }
 if (request.method !== 'POST') return errorResponse(405,'Analýzu spusťte odesláním čísla NEN.');
 const origin = request.headers.get('Origin');
 if (origin && origin!==requestUrl.origin) return errorResponse(403,'Požadavek musí přijít z tendr.ai.');
 if (request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json') return errorResponse(415,'Očekáváme číslo NEN ve formátu JSON.');
 let reference: string;
 try {
  const body = new TextDecoder().decode(await readBounded(request.body,512));
  reference = inputSchema.parse(JSON.parse(body)).reference;
 } catch {
  return errorResponse(400,'Zadejte číslo ve formátu N006/26/V00018665.');
 }
 if (!available || !env.AI || !env.NEN_RATE_LIMIT || !env.CUSTOMERS) {
  return errorResponse(503,'Živé stahování zatím není dostupné. Čeká na připojení a ověření schváleného zdroje příloh NEN.');
 }
 const db=env.CUSTOMERS;
 const account=await getCustomer(request,db).catch(()=>null);
 if(!account)return errorResponse(401,'Přihlaste se a využijte kredit na analýzu.');
 if(account.credits<1)return errorResponse(402,'Na další analýzu potřebujete 1 kredit.');
 const quota = await env.NEN_RATE_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'local'});
 if (!quota.success) return errorResponse(429,'Dosáhli jste limitu analýz. Zkuste to za minutu.');
 let reservation:string|null;
 try {
  reservation=await reserveCustomerCredit(account.id,db);
 } catch {
  return errorResponse(503,'Kredit se teď nepodařilo rezervovat. Zkuste to za chvíli.');
 }
 if(!reservation)return errorResponse(402,'Na další analýzu potřebujete 1 kredit.');
 const reservationId=reservation;

 const {readable,writable} = new TransformStream<Uint8Array,Uint8Array>();
 const writer = writable.getWriter();
 const encoder = new TextEncoder();
 const disconnect = new AbortController();
 const deadline = AbortSignal.any([request.signal,disconnect.signal,AbortSignal.timeout(360_000)]);
 const config = {
  providerUrl:env.NEN_SOURCE_URL,
  providerToken:env.NEN_SOURCE_TOKEN,
  allowedOrigins:env.NEN_DOCUMENT_ORIGINS,
  profiles,
  lookupProfile:indexEnabled ? (reference:string)=>lookupPublicIndex(env.ASSETS,requestUrl.origin,reference) : undefined,
 };
 const ai = env.AI;
 const send = (event:NenAnalysisEvent) => writer.write(encoder.encode(JSON.stringify(event)+'\n'));
 ctx.waitUntil(writer.closed.catch(()=>{disconnect.abort();}));
 ctx.waitUntil((async () => {
  let settled=false;
  try {
   const report = await analyzeNen(reference,config,async (system,input,schema)=>{
    deadline.throwIfAborted();
    const response = await ai.run(model,{
     messages:[{role:'system',content:system},{role:'user',content:input}],
     max_tokens:4800,
     temperature:0.1,
     response_format:{type:'json_schema',json_schema:schema},
    });
    deadline.throwIfAborted();
    const generated = z.object({response:z.unknown()}).parse(response).response;
    return typeof generated==='string' ? JSON.parse(generated) : generated;
   },send,deadline);
   deadline.throwIfAborted();
   await settleCustomerCredit(account.id,reservationId,report.findings.length>0,db);
   settled=true;
   await send({type:'result',report});
  } catch (error) {
   if(!settled)await settleCustomerCredit(account.id,reservationId,false,db).catch(()=>{});
   const message = error instanceof NenSourceError ? error.message : deadline.aborted
    ? 'Analýza překročila dostupný čas. Zkuste to znovu.'
    : 'Podklady se nepodařilo zpracovat. Zkuste to znovu později.';
   await send({type:'error',message}).catch(()=>{});
  } finally {
   await writer.close().catch(()=>{});
  }
 })());
 return new Response(readable,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

export default {
 fetch(request:Request, env:Bindings, ctx:Pick<ExecutionContext,'waitUntil'>) {
  const path=new URL(request.url).pathname;
  if(path==='/api/account'||path==='/api/subscription-requests') {
   if(!env.CUSTOMERS||!env.CUSTOMER_RATE_LIMIT)return errorResponse(503,'Zákaznický účet je dočasně nedostupný.');
   return path==='/api/account'?handleCustomerAccount(request,env.CUSTOMERS,env.CUSTOMER_RATE_LIMIT)
    :handlePurchaseRequest(request,env.CUSTOMERS,env.CUSTOMER_RATE_LIMIT);
  }
  if (path==='/api/nen/analysis') return handleAnalysis(request,env,ctx);
  return env.ASSETS.fetch(request);
 },
};
