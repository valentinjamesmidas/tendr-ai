import { z } from 'zod';
import { type ProfileMatch } from './nen-official';
import { readBounded } from './nen-files';

type Assets = {fetch(request:Request):Promise<Response>};
const monthPattern=/^20\d\d-(0[1-9]|1[0-2])$/;
const entrySchema=z.tuple([z.string().min(1).max(400),z.string().regex(monthPattern)]);
const metaSchema=z.object({through:z.string().regex(monthPattern),count:z.number().int().positive()});

async function readAsset(assets:Assets,origin:string,path:string,limit:number) {
 const response=await assets.fetch(new Request(new URL(path,origin)));
 if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json'))return undefined;
 return JSON.parse(new TextDecoder().decode(await readBounded(response.body,limit))) as unknown;
}

export async function readPublicIndexMeta(assets:Assets,origin:string) {
 const parsed=metaSchema.safeParse(await readAsset(assets,origin,'/nen-index/meta.json',1000));
 return parsed.success ? parsed.data : undefined;
}

export async function lookupPublicIndex(assets:Assets,origin:string,reference:string):Promise<ProfileMatch|undefined> {
 const year=reference.slice(5,7);
 if(!/^\d{2}$/.test(year))return undefined;
 const data=await readAsset(assets,origin,`/nen-index/${year}.json`,6*1024*1024);
 if(!data||typeof data!=='object'||!Object.hasOwn(data,reference))return undefined;
 const entry=entrySchema.safeParse((data as Record<string,unknown>)[reference]);
 return entry.success ? {profile:entry.data[0],month:entry.data[1]} : undefined;
}
