import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';
import { indexNenStream } from './nen-index-records.mjs';

const folder = new URL('../apps/web/public/nen-index/',import.meta.url);
const monthPattern = /^20\d\d-(0[1-9]|1[0-2])$/;
const refPattern = /^N006\/\d{2}\/V\d{8}$/;
const args=process.argv.slice(2);
if (!args.length || args.some(arg=>!monthPattern.test(arg.split('=')[0]))) {
 console.error('Usage: node scripts/update-nen-index.mjs YYYY-MM [YYYY-MM=/path/to/official.zip] …');
 process.exit(2);
}

async function loadSnapshot(month,path) {
 const [year,monthNumber]=month.split('-');
 const url=`https://isvz.nipez.cz/sites/default/files/content/opendata-rvz/VZ-${monthNumber}-${year}.zip`;
 let bytes;
 if(path)bytes=new Uint8Array(await readFile(path));
 else{
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(180_000)});
  if(!response.ok)throw new Error(`${month}: HTTP ${response.status}`);
  bytes=new Uint8Array(await response.arrayBuffer());
 }
 const reader=new ZipReader(new Uint8ArrayReader(bytes),{useWebWorkers:false});
 try{
  for await(const entry of reader.getEntriesGenerator()){
   if(entry.directory||!entry.filename.endsWith('.json'))continue;
   if(entry.uncompressedSize>600*1024*1024)throw new Error(`${month}: export exceeds 600 MiB`);
   const {readable,writable}=new globalThis.TransformStream();
   const [,records]=await Promise.all([
    entry.getData(writable,{useWebWorkers:false,checkSignature:true}),
    indexNenStream(readable,month),
   ]);
   return records;
  }
  throw new Error(`${month}: JSON entry is missing`);
 }finally{await reader.close();}
}

const index={};
await mkdir(folder,{recursive:true});
for(const name of await readdir(folder)){
 if(!/^\d{2}\.json$/.test(name))continue;
 Object.assign(index,JSON.parse(await readFile(new URL(name,folder),'utf8')));
}
for(const arg of args){
 const [month,path]=arg.split('=');
 const records=await loadSnapshot(month,path);
 console.log(`${month}: ${Object.keys(records).length} references`);
 for(const [reference,entry] of Object.entries(records)){
  if(!index[reference]||index[reference][1]<=month)index[reference]=entry;
 }
}

const years=new Map();
for(const reference of Object.keys(index).sort()){
 if(!refPattern.test(reference))throw new Error(`Invalid reference in index: ${reference}`);
 const year=reference.slice(5,7);
 if(!years.has(year))years.set(year,{});
 years.get(year)[reference]=index[reference];
}
for(const [year,records] of years)await writeFile(new URL(`${year}.json`,folder),JSON.stringify(records)+'\n');
const through=Object.values(index).map(entry=>entry[1]).sort().at(-1);
if(!through)throw new Error('No matching references in the selected months.');
await writeFile(new URL('meta.json',folder),JSON.stringify({through,count:Object.keys(index).length})+'\n');
console.log(`Wrote ${Object.keys(index).length} references to ${fileURLToPath(folder)}`);
