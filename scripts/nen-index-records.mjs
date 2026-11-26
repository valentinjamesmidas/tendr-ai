const referencePattern = /^N006\/\d{2}\/V\d{8}$/;

function profileSlug(address) {
 try {
  const url = new URL(address);
  if (url.origin !== 'https://nen.nipez.cz') return null;
  return url.pathname.match(/^\/(?:profil|profily-zadavatelu(?:-platne)?\/detail-profilu)\/([A-Za-z0-9_.-]{1,96})\/?$/i)?.[1]?.toLowerCase() ?? null;
 } catch { return null; }
}

function references(item) {
 const ids = item?.identifikatory_v_elektronickem_nastroji ?? [];
 return ids.filter(id=>id.kod_nastroje==='NEN')
  .map(id=>String(id.identifikator).trim().toUpperCase().replaceAll('-','/'))
  .filter(id=>referencePattern.test(id));
}

export function indexNenSnapshot(snapshot,month) {
 const rows = snapshot?.data;
 if (!Array.isArray(rows)) throw new Error('Invalid ISVZ data array');
 const index = {};
 for (const row of rows) {
  const tender = row.verejna_zakazka;
  if (!tender) continue;
  const procedures = tender.zadavaci_postupy ?? [];
  const procedureProfiles = new Map();
  const profiles = new Set();
  for (const procedure of procedures) {
   const authorities = procedure.zadavatel_zadavaciho_postupu?.zadavatele ?? [];
   const slugs = authorities.map(authority=>profileSlug(authority.adresa_profilu)).filter(Boolean);
   for (const slug of slugs) profiles.add(slug);
   if (slugs.length) for (const ref of references(procedure)) procedureProfiles.set(ref,[...new Set(slugs)].slice(0,4));
  }
  const fallback = [...profiles].slice(0,4);
  const ids = [...new Set([
   ...references(tender), ...(tender.casti_verejne_zakazky??[]).flatMap(references), ...procedures.flatMap(references),
  ])];
  for (const ref of ids) {
   const slugs=procedureProfiles.get(ref)??fallback;
   if (slugs.length) index[ref]=[slugs.join(','),month];
  }
 }
 return index;
}

// ISVZ exports a small header followed by its data array. Process one record at
// a time so newer archives do not require a full uncompressed copy in memory.
export async function indexNenStream(stream,month) {
 const reader=stream.pipeThrough(new globalThis.TextDecoderStream()).getReader();
 const index={};
 let header='';
 let started=false;
 let quoted=false;
 let escaped=false;
 let depth=0;
 let chunks=[];
 let size=0;
 let closed=false;
 function append(slice) {
  size+=slice.length;
  if(size>24*1024*1024)throw new Error('An ISVZ record exceeds 24 MiB');
  chunks.push(slice);
 }
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   if(closed)continue;
   let text=value;
   if(!started){
    header+=text;
    const start=header.match(/"data"\s*:\s*\[/);
    if(!start){
     if(header.length>128*1024)throw new Error('ISVZ data array is missing');
     continue;
    }
    text=header.slice(start.index+start[0].length);
    header='';
    started=true;
   }
   let begin=depth>0?0:-1;
   for(let i=0;i<text.length;i++){
    const char=text[i];
    if(depth===0){
     if(char===']'){closed=true;break;}
     if(char==='{'){depth=1;begin=i;}
     else if(!/[\s,]/.test(char))throw new Error('Unexpected value in ISVZ data array');
     continue;
    }
    if(quoted){
     if(escaped)escaped=false;
     else if(char==='\\')escaped=true;
     else if(char==='"')quoted=false;
    }else if(char==='"')quoted=true;
    else if(char==='{')depth++;
    else if(char==='}'&&--depth===0){
     append(text.slice(begin,i+1));
     Object.assign(index,indexNenSnapshot({data:[JSON.parse(chunks.join(''))]},month));
     chunks=[];
     size=0;
     begin=-1;
    }
   }
   if(depth>0&&begin>=0)append(text.slice(begin));
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(!closed)throw new Error('Incomplete ISVZ data array');
 return index;
}
