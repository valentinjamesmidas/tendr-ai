import { tenderSchema, type Tender, type SourceProvider } from '@tendr/schemas';
export function normalizeReference(input:string):string {
 let value=input.trim();
 if(value.length>2048) throw new Error('Číslo zakázky je příliš dlouhé.');
 if(/^https?:/i.test(value)) {
  let url:URL;
  try { url=new URL(value); } catch {throw new Error('Neplatná adresa zakázky.');}
  if(url.protocol!=='https:'||url.hostname!=='nen.nipez.cz'||url.port||url.username||url.password||url.search||url.hash) throw new Error('Podporujeme pouze přímé HTTPS adresy nen.nipez.cz bez dalších parametrů.');
  const match=url.pathname.match(/^\/verejne-zakazky\/detail-zakazky\/(N006-\d{2}-V\d{8})\/?$/i);
  if(!match) throw new Error('Nepodporovaný formát adresy NEN. Zadejte číslo zakázky.');
  value=match[1]!;
 }
 value=value.toUpperCase().replace(/-/g,'/');
 if(!/^N006\/\d{2}\/V\d{8}$/.test(value)) throw new Error('Zadejte číslo ve formátu N006/26/V00018665.');
 return value;
}
export const fixtures:Tender[]=[
 {
  reference:'N006/26/V00018665',title:'Rekonstrukce základní školy — ukázková zakázka',authority:'Demo město Lhota (smyšlený zadavatel)',sector:'construction',valueMinor:4850000000,deadline:'2026-12-18T09:00:00+01:00',synthetic:true,penaltyBps:5,retentionBps:500,
  documents:[
   {id:'construction-contract',version:'1',name:'Návrh smlouvy.txt',locator:'čl. 8',content:'SYNTETICKÁ DEMO DOKUMENTACE — NEJDE O SKUTEČNOU ZAKÁZKU.\nČl. 8: Cena díla činí 48 500 000 Kč bez DPH. Smluvní pokuta za prodlení činí 0,05 % z ceny díla za každý den. Zádržné činí 5 % z ceny díla. Splatnost faktur činí 60 dnů. Dokončení díla do 30. 6. 2027.'},
   {id:'construction-spec',version:'1',name:'Technická specifikace.txt',locator:'oddíl 3',content:'SYNTETICKÁ DEMO DOKUMENTACE.\nOddíl 3: Dokončení díla do 31. 7. 2027. Zadavatel požaduje dvě reference na rekonstrukci škol, každou v hodnotě nejméně 20 000 000 Kč bez DPH. Nabídka musí obsahovat položkový rozpočet a harmonogram.'}
  ],qualification:[{id:'construction-references',requirement:'Dvě obdobné stavební reference',condition:'Dvě rekonstrukce škol, každá nejméně 20 000 000 Kč bez DPH.',documentId:'construction-spec',status:'missing_evidence'}]
 },
 {
  reference:'N006/26/V00020420',title:'Dodávka informačního systému — ukázková zakázka',authority:'Demo institut (smyšlený zadavatel)',sector:'it',valueMinor:680000000,deadline:'2026-12-22T10:00:00+01:00',synthetic:true,penaltyBps:10,retentionBps:1000,
  documents:[
   {id:'it-contract',version:'1',name:'Smlouva o dodávce IS.txt',locator:'čl. 6',content:'SYNTETICKÁ DEMO DOKUMENTACE — NEJDE O SKUTEČNOU ZAKÁZKU.\nČl. 6: Cena dodávky činí 6 800 000 Kč bez DPH. Smluvní pokuta za prodlení činí 0,10 % z ceny dodávky za každý den. Zádržné činí 10 % z ceny dodávky. Splatnost faktur činí 45 dnů. Záruka trvá 36 měsíců.'},
   {id:'it-spec',version:'1',name:'Požadavky na dodavatele.txt',locator:'oddíl 2',content:'SYNTETICKÁ DEMO DOKUMENTACE.\nOddíl 2: Dodavatel doloží tři reference na informační systém, každou v hodnotě nejméně 2 000 000 Kč bez DPH. Nabídka musí obsahovat SLA, plán migrace a bezpečnostní koncepci. Požadována je dostupnost služby 99,9 %.'}
  ],qualification:[{id:'it-references',requirement:'Tři reference na informační systémy',condition:'Tři informační systémy, každý nejméně 2 000 000 Kč bez DPH.',documentId:'it-spec',status:'missing_evidence'}]
 }
].map(t=>tenderSchema.parse(t));
export async function documentSetHash(documents:Tender['documents']):Promise<string> {
 const sorted=[...documents].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(new Set(sorted.map(d=>d.id)).size!==sorted.length)throw new Error('Duplicate document identity');
 const encoded=new TextEncoder().encode(JSON.stringify(sorted.map(({id,version,name,locator,content})=>({id,version,name,locator,content}))));
 const hash=await crypto.subtle.digest('SHA-256',encoded);
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export class MockSourceProvider implements SourceProvider {
 normalizeReference=normalizeReference;
 async fetchMetadata(reference:string):Promise<Tender> {
  const tender=fixtures.find(t=>t.reference===normalizeReference(reference));
  if(!tender)throw new Error('Zakázka není součástí dema. Zvolte jednu ze dvou ukázkových zakázek.');
  return structuredClone(tender);
 }
 async listDocuments(reference:string){return (await this.fetchMetadata(reference)).documents;}
 async downloadDocument(reference:string,documentId:string){
  const doc=(await this.listDocuments(reference)).find(d=>d.id===documentId);
  if(!doc)throw new Error('Dokument nebyl nalezen.');
  return doc;
 }
 async getSourceVersion(reference:string){return documentSetHash(await this.listDocuments(reference));}
}
