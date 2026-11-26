import { SaxesParser } from 'saxes';
import { readBounded } from './nen-files';

const nenOrigin = 'https://nen.nipez.cz';
const profileKey = /^[A-Za-z0-9_.-]{1,96}$/;
const machineNamespace = /^urn:cz:isvz:mmr:schemas:vz-z-profilu-zadavatele:/;
const day = 86_400_000;
const dateParts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'});
const xmlFields = new Set(['nazev_zadavatele','id_objektu','nazev_vz','url','typ_dokumentu','jiny_dokument_nazev','cas_vlozeni_na_profil']);
type DocumentKind = 'documentation'|'clarification'|'amendment'|'other';
interface OfficialDocument {name:string;downloadUrl:string;publishedAt?:string;kind:DocumentKind}
export interface OfficialManifest {
 reference:string;
 title:string;
 authority:string|null;
 complete:boolean;
 documents:OfficialDocument[];
}

export interface ProfileMatch { profile:string; month?:string }
export type FindProfile = (reference:string) => Promise<ProfileMatch|undefined>;

export function getProfileSettings(value:string|undefined) {
 return [...new Set((value??'').split(',').map(profile=>profile.trim()).filter(profile=>profileKey.test(profile) && profile!=='.' && profile!=='..'))].slice(0,4);
}

function fileUrl(input:string) {
 const value = input.replace(/&(?:amp;)+/g,'&');
 let url:URL;
 try {url = new URL(value,nenOrigin);} catch {return null;}
 if(url.origin!==nenOrigin||url.username||url.password||url.hash||!['/file','/dokument'].includes(url.pathname.toLowerCase()))return null;
 return url;
}

function classify(type:string):DocumentKind {
 const name = type.toLowerCase();
 if (/vysvětlen/.test(name)) return 'clarification';
 if (/změn|doplněn/.test(name)) return 'amendment';
 if (/zadávac|výzv/.test(name)) return 'documentation';
 return 'other';
}

export function parseNenProfileXml(xml:string, reference:string):OfficialManifest|null {
 if(/<!DOCTYPE/i.test(xml)) throw new Error('Unsupported profile XML');
 const parser = new SaxesParser({xmlns:true});
 const path:string[] = [];
 let field:{key:string;depth:number;text:string}|null = null;
 let document:Record<string,string>|null = null;
 let tender:{reference:string;title:string;documents:OfficialDocument[];seen:Set<string>}|null = null;
 let match:OfficialManifest|null = null;
 let authority:string|null = null;
 let records = 0;
 let docDepth = 0;
 let limited = false;
 parser.on('error',error=>{throw error;});
 parser.on('opentag',tag=>{
  path.push(tag.local);
  if(path.length===1&&(tag.local!=='profil'||!machineNamespace.test(tag.uri))) throw new Error('Response is not NEN profile XML');
  if(path.length===2&&tag.local==='zakazka'){
   records++;
   if(records>15_000)throw new Error('Profile contains too many records');
   tender = {reference:'',title:'',documents:[],seen:new Set()};
   limited = false;
  }
  if(tender&&tag.local==='dokument'&&path.at(-2)==='dokumenty'){
   document = {};
   docDepth = path.length;
  }
  if(xmlFields.has(tag.local)){
   const profileField=path.length===3&&path[1]==='zadavatel'&&tag.local==='nazev_zadavatele';
   const tenderField=tender&&path.length===3&&path[1]==='zakazka'&&['id_objektu','nazev_vz'].includes(tag.local);
   if(profileField||tenderField||(document&&path.length===docDepth+1))field={key:tag.local,depth:path.length,text:''};
  }
 });
 const append=(value:string)=>{if(field)field.text=(field.text+value).slice(0,2400);};
 parser.on('text',append);
 parser.on('cdata',append);
 parser.on('closetag',tag=>{
  if(field?.depth===path.length){
   const value=field.text.trim();
   if(document&&field.depth===docDepth+1)document[field.key]=value;
   else if(field.key==='nazev_zadavatele')authority=value.slice(0,400)||null;
   else if(tender&&field.key==='id_objektu')tender.reference=value.toUpperCase().replaceAll('-','/');
   else if(tender&&field.key==='nazev_vz')tender.title=value.slice(0,500);
   field=null;
  }
  if(document&&tag.local==='dokument'&&path.length===docDepth&&tender){
   const type=document.typ_dokumentu||'Příloha';
   const url=document.url&&fileUrl(document.url);
   if(!url)limited=true;
   else if(tender.documents.length>=200)limited=true;
   else if(!tender.seen.has(url.href)){
    const suffix=url.searchParams.get('typ')?.trim()??'';
    const ext=/^\.[A-Za-z0-9]{1,8}$/.test(suffix) ? suffix : '';
    const stem=(document.jiny_dokument_nazev||type).slice(0,270);
    const name=stem.toLowerCase().endsWith(ext.toLowerCase())&&ext ? stem : `${stem} ${tender.documents.length+1}${ext}`;
    const stamp=document.cas_vlozeni_na_profil;
    const publishedAt=stamp&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(stamp) ? stamp : undefined;
    tender.documents.push({name,downloadUrl:url.href,publishedAt,kind:classify(type)});
    tender.seen.add(url.href);
   }
   document=null;
  }
  if(tender&&tag.local==='zakazka'&&path.length===2){
   if(tender.reference===reference){
    match={reference,title:tender.title||reference,authority,complete:!limited,documents:tender.documents};
   }
   tender=null;
  }
  path.pop();
 });
 parser.write(xml).close();
 return match;
}

function ddmmyyyy(date:Date) {
 const pieces=dateParts.formatToParts(date);
 return ['day','month','year'].map(key=>pieces.find(piece=>piece.type===key)?.value).join('');
}

function profileUrl(profile:string, start:Date, end:Date) {
 const url=new URL(`/profil/${encodeURIComponent(profile)}/XMLdataVZ`,nenOrigin);
 url.searchParams.set('od',ddmmyyyy(start));
 url.searchParams.set('do',ddmmyyyy(end));
 return url;
}

export async function findInOfficialProfiles(reference:string, profiles:string[], lookup:FindProfile|undefined, signal:AbortSignal) {
 const indexed=await lookup?.(reference);
 const candidates=getProfileSettings(indexed ? indexed.profile : profiles.join(','));
 if(!candidates.length)return null;
 const now=new Date();
 const oldest=new Date(now.getTime()-365*day);
 const near=new Date(now.getTime()-90*day);
 const archiveMonth=indexed?.month&&/^20\d\d-(0[1-9]|1[0-2])$/.test(indexed.month) ? new Date(`${indexed.month}-01T12:00:00Z`) : null;
 const archiveEnd=archiveMonth&&new Date(Math.min(now.getTime(),archiveMonth.getTime()+120*day));
 const ranges:[Date,Date][] = [[archiveMonth&&archiveMonth>oldest ? archiveMonth : near,now]];
 if(archiveMonth&&archiveMonth<oldest&&archiveEnd&&archiveEnd>=archiveMonth)ranges.push([archiveMonth,archiveEnd]);
 else if(!archiveMonth)ranges.push([oldest,new Date(near.getTime()-day)]);
 let lastFailure:string|undefined;
 let exportsRead=0;
 for(const profile of candidates){
  for(const [start,end] of ranges){
   let state='connection';
   try{
    const url=profileUrl(profile,start,end);
    const signalForRange=AbortSignal.any([signal,AbortSignal.timeout(16_000)]);
    let response=await fetch(url,{redirect:'manual',signal:signalForRange,headers:{Accept:'application/xml,text/xml'}});
    if([301,302,303,307,308].includes(response.status)){
     state=`redirect:${response.status}`;
     const destination=new URL(response.headers.get('location')??'',url);
     await response.body?.cancel();
     if(destination.origin!==nenOrigin||destination.username||destination.password||destination.hash
        ||destination.pathname.toLowerCase().replace(/\/$/,'')!==url.pathname.toLowerCase()
        ||destination.search!==url.search||destination.href===url.href)throw new Error('Unsupported profile redirect');
     response=await fetch(destination,{redirect:'manual',signal:signalForRange,headers:{Accept:'application/xml,text/xml'}});
    }
    state=`http:${response.status}`;
    if(!response.ok)throw new Error(`NEN XML returned ${response.status}`);
    state='body';
    const bytes=await readBounded(response.body,4*1024*1024);
    state='xml';
    const manifest=parseNenProfileXml(new TextDecoder().decode(bytes),reference);
    exportsRead++;
    if(manifest)return manifest;
   }catch(error){
    signal.throwIfAborted();
    lastFailure=state;
    console.warn('NEN XML fetch failed',{profile,stage:state,errorType:error instanceof Error ? error.name : 'Unknown'});
   }
  }
 }
 if(!exportsRead&&lastFailure)throw new Error(`NEN XML unavailable (${lastFailure})`);
 return null;
}
