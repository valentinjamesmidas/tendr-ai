import { SaxesParser } from 'saxes';
import { Uint8ArrayReader, ZipReader, type FileEntry } from '@zip.js/zip.js';
import { getDocumentProxy } from 'unpdf';

export const fileLimit = 8 * 1024 * 1024;
const archiveLimit = 20 * 1024 * 1024;
const partLimit = 7000;
const maxPartsPerFile = 100;
interface ArchiveBudget { left:number }

interface TextPart { locator: string; content: string }
export interface ReadFile { name: string; parts: TextPart[]; notes: string[] }

export async function readBounded(body: ReadableStream<Uint8Array> | null, limit: number) {
 if (!body) throw new Error('Zdroj nevrátil obsah.');
 const reader = body.getReader();
 const chunks: Uint8Array[] = [];
 let size = 0;
 try {
  while (true) {
   const { value, done } = await reader.read();
   if (done) break;
   size += value.length;
   if (size > limit) {
    await reader.cancel();
    throw new Error('Soubor překročil velikostní limit.');
   }
   chunks.push(value);
  }
 } finally {
  reader.releaseLock();
 }
 const result = new Uint8Array(size);
 let offset = 0;
 for (const chunk of chunks) {
  result.set(chunk, offset);
  offset += chunk.length;
 }
 return result;
}

function normalizeText(value: string) {
 return value.normalize('NFC').replace(/\u00ad/g,'').replace(/\s+/g,' ').trim();
}

function addText(file: ReadFile, locator: string, value: string) {
 let text = normalizeText(value);
 if (!text) return;
 for (let section = 1; text.length; section++) {
  if (file.parts.length >= maxPartsPerFile) {
   const note = 'Část obsahu přesáhla limit zpracování.';
   if (!file.notes.includes(note)) file.notes.push(note);
   return;
  }
  const cut = text.length <= partLimit ? text.length : Math.max(partLimit / 2, text.lastIndexOf(' ',partLimit));
  const location = section > 1 || text.length > partLimit ? `${locator}, úsek ${section}` : locator;
  file.parts.push({ locator:location, content:text.slice(0,cut).trim() });
  // Keep a short overlap so a requirement crossing the boundary remains citable.
  if (cut === text.length) break;
  const overlap = text.indexOf(' ',cut - 220);
  text = text.slice(overlap > 0 && overlap < cut ? overlap + 1 : cut).trimStart();
 }
}

function decode(bytes: Uint8Array) {
 if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
 try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
 catch { return new TextDecoder('windows-1250').decode(bytes); }
}

function xmlParser(xml: string) {
 if (/<!DOCTYPE/i.test(xml)) throw new Error('XML s externí definicí nelze zpracovat.');
 const parser = new SaxesParser({xmlns:true});
 parser.on('error',error => { throw error; });
 return parser;
}

function xmlTextBlocks(xml: string, block: string) {
 const parser = xmlParser(xml);
 const blocks: string[] = [];
 let blockDepth = 0;
 let textDepth = 0;
 let value = '';
 parser.on('opentag',tag => {
  if (tag.local === block) blockDepth++;
  if (blockDepth && tag.local === 't') textDepth++;
  if (blockDepth && ['tab','br'].includes(tag.local)) value += ' ';
 });
 parser.on('text',text => { if (textDepth) value += text; });
 parser.on('closetag',tag => {
  if (tag.local === 't' && textDepth) textDepth--;
  if (tag.local === block && --blockDepth === 0) {
   blocks.push(value);
   value = '';
  }
 });
 parser.write(xml).close();
 return blocks;
}

function xmlRows(xml: string, shared: string[]) {
 const parser = xmlParser(xml);
 const rows: {number:string;content:string}[] = [];
 let cells: string[] = [];
 let cell = '';
 let type = '';
 let ref = '';
 let number = '';
 let active = false;
 let isText = false;
 parser.on('opentag',tag => {
  if (tag.local === 'row') number = tag.attributes.r?.value ?? String(rows.length+1);
  if (tag.local === 'c') {
   active = true;
   ref = tag.attributes.r?.value ?? '';
   type = tag.attributes.t?.value ?? '';
   cell = '';
  }
  if (active && ['v','t'].includes(tag.local)) isText = true;
 });
 parser.on('text',text => { if (isText) cell += text; });
 parser.on('closetag',tag => {
  if (['v','t'].includes(tag.local)) isText = false;
  if (tag.local === 'c') {
   active = false;
   const value = type === 's' && /^\d+$/.test(cell) ? shared[Number(cell)] ?? '' : cell;
   if (value.trim()) cells.push(ref ? `${ref} ${value}` : value);
  }
  if (tag.local === 'row') {
   if (cells.length) rows.push({number,content:cells.join(' | ')});
   cells = [];
  }
 });
 parser.write(xml).close();
 return rows;
}

async function withArchive<T>(bytes: Uint8Array, budget:ArchiveBudget, select: (entries: FileEntry[], extract: (entry: FileEntry) => Promise<Uint8Array>) => Promise<T>) {
 const reader = new ZipReader(new Uint8ArrayReader(bytes),{useWebWorkers:false});
 try {
  const entries: FileEntry[] = [];
  let entriesSeen = 0;
  for await (const entry of reader.getEntriesGenerator()) {
   if (++entriesSeen > 180) throw new Error('Archiv má příliš mnoho položek.');
   if (!entry.directory) entries.push(entry);
  }
  return await select(entries,async entry => {
   if (entry.encrypted) throw new Error('Soubor je šifrovaný.');
   if (entry.uncompressedSize > fileLimit || entry.uncompressedSize > budget.left) throw new Error('Rozbalená data překročila velikostní limit.');
   const chunks: Uint8Array[] = [];
   let size = 0;
   await entry.getData(new WritableStream<Uint8Array>({
    write(chunk) {
     size += chunk.length;
     budget.left -= chunk.length;
     if (size > fileLimit || budget.left < 0) throw new Error('Rozbalená data překročila velikostní limit.');
     chunks.push(chunk.slice());
    },
   }),{useWebWorkers:false,checkSignature:true});
   if (size !== entry.uncompressedSize) throw new Error('Velikost rozbaleného souboru nesouhlasí.');
   const output = new Uint8Array(size);
   let offset = 0;
   for (const chunk of chunks) { output.set(chunk,offset); offset += chunk.length; }
   return output;
  });
 } finally {
  await reader.close();
 }
}

async function readPdf(bytes: Uint8Array, file: ReadFile) {
 const pdf = await getDocumentProxy(bytes,{disableFontFace:true,useSystemFonts:false,maxImageSize:2_000_000,enableXfa:false});
 try {
  const missing: number[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages,100) && file.parts.length < maxPartsPerFile; i++) {
   const page = await pdf.getPage(i);
   const data = await page.getTextContent();
   const text = data.items.map(item=>'str'in item ? item.str : '').join(' ');
   if (normalizeText(text)) addText(file,`Strana ${i}`,text);
   else missing.push(i);
   if (i < pdf.numPages && file.parts.length >= maxPartsPerFile) file.notes.push('Další strany překročily limit zpracování.');
   page.cleanup();
  }
  if (pdf.numPages > 100) file.notes.push('Strany za 100. stranou překročily limit zpracování.');
  if (missing.length) file.notes.push(`Strany bez textové vrstvy: ${missing.join(', ')}. Vyžadují OCR.`);
 } finally {
  await pdf.loadingTask.destroy();
 }
}

async function readOffice(bytes: Uint8Array, file: ReadFile, format: string, budget:ArchiveBudget) {
 await withArchive(bytes,budget,async (entries,extract) => {
  if (format === 'docx') {
   const docs = entries.filter(entry=>/^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(entry.filename));
   if (!docs.some(doc=>doc.filename === 'word/document.xml')) throw new Error('V DOCX chybí tělo dokumentu.');
   for (const doc of docs) {
    const paragraphs = xmlTextBlocks(decode(await extract(doc)),'p').filter(p=>p.trim());
    for (let i=0; i<paragraphs.length; i+=12) {
     const section = doc.filename === 'word/document.xml' ? 'Text' : doc.filename.replace(/^word\//,'').replace(/\.xml$/,'');
     addText(file,`${section}, odstavce ${i+1}–${Math.min(i+12,paragraphs.length)}`,paragraphs.slice(i,i+12).join('\n'));
    }
   }
   return;
  }
  const strings = entries.find(entry=>entry.filename==='xl/sharedStrings.xml');
  const shared = strings ? xmlTextBlocks(decode(await extract(strings)),'si') : [];
  const sheets = entries.filter(entry=>/^xl\/worksheets\/sheet\d+\.xml$/.test(entry.filename));
  if (!sheets.length) throw new Error('V XLSX chybí listy.');
  for (const sheet of sheets) {
   const rows = xmlRows(decode(await extract(sheet)),shared);
   const sheetNumber = sheet.filename.match(/sheet(\d+)/)?.[1];
   for (let i=0; i<rows.length; i+=15) {
    const group = rows.slice(i,i+15);
    addText(file,`List ${sheetNumber}, řádky ${group[0].number}–${group[group.length-1].number}`,group.map(row=>row.content).join('\n'));
   }
  }
 });
}

export async function readAttachment(name: string, bytes: Uint8Array, depth=0, budget:ArchiveBudget={left:archiveLimit}): Promise<ReadFile[]> {
 const file: ReadFile = {name,parts:[],notes:[]};
 const format = name.split('.').at(-1)?.toLowerCase();
 try {
  if (format === 'zip') {
   if (depth >= 2) throw new Error('Další úroveň vnořeného archivu překročila limit.');
   return await withArchive(bytes,budget,async (entries,extract)=>{
    const files: ReadFile[] = [];
    for (const entry of entries.slice(0,40)) {
     const path = entry.filename;
     if (path.startsWith('__MACOSX/') || path.endsWith('/.DS_Store') || path === '.DS_Store') continue;
     const label = `${name} / ${path}`.slice(0,550);
     if (files.length >= 60) { file.notes.push('Další položky archivu překročily limit zpracování.'); break; }
     try {
      if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new Error('Cesta uvnitř archivu není platná.');
      files.push(...await readAttachment(label,await extract(entry),depth+1,budget));
     } catch (error) {
      files.push({name:label,parts:[],notes:[error instanceof Error ? error.message : 'Položku se nepodařilo rozbalit.']});
     }
    }
    if (entries.length>40) file.notes.push('Další položky archivu překročily limit zpracování.');
    if (!files.length || file.notes.length) files.push(file);
    return files.slice(0,80);
   });
  }
  if (format === 'pdf') await readPdf(bytes,file);
  else if (format === 'docx' || format === 'xlsx') await readOffice(bytes,file,format,budget);
  else if (['txt','csv','xml'].includes(format ?? '')) addText(file,'Obsah souboru',decode(bytes));
  else file.notes.push('Formát vyžaduje ruční zpracování.');
 } catch {
  file.notes.push('Soubor nelze otevřít nebo překročil limit zpracování.');
 }
 if (!file.parts.length && !file.notes.length) file.notes.push('V souboru se nepodařilo najít čitelný text.');
 return [file];
}
