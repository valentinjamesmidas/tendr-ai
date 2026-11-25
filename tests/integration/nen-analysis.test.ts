import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { analyzeNen } from '../../worker/nen-analysis';
import { readAttachment } from '../../worker/nen-files';
import worker from '../../worker';
import { nenAnalysisSchema, type NenAnalysisEvent } from '../../packages/schemas/src/index';

const reference='N006/26/V00018665';
const source='https://resolver.example/public';
async function zip(entries:Record<string,string|Uint8Array>) {
 const writer=new ZipWriter(new Uint8ArrayWriter(),{useWebWorkers:false});
 for (const [name,body] of Object.entries(entries)) {
  await writer.add(name,typeof body==='string' ? new TextReader(body) : new Uint8ArrayReader(body));
 }
 return writer.close();
}
function manifest(documents:object[], complete=true) {
 return Response.json({reference,title:'Oprava knihovny',authority:'Město',complete,documents});
}
const due='Lhůta pro podání nabídek končí 18. 12. 2026 v 9:00.';
const aiFinding={
 category:'submission',
 severity:'critical',
 title:'Lhůta pro podání',
 requirement:due,
 impact:'Pozdní nabídka se nevyhodnotí.',
 action:'Naplánujte podání před koncem lhůty.',
};

afterEach(()=>vi.unstubAllGlobals());

describe('NEN ingestion',()=>{
 it('finds a manifest by number, opens ZIP, extracts DOCX and XLSX, and rejects ungrounded findings',async()=>{
  const word=await zip({'word/document.xml':'<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Doložte dvě reference stavebních prací.</w:t></w:r></w:p></w:body></w:document>'});
  const workbook=await zip({'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="3"><c r="A3" t="inlineStr"><is><t>Výkop ve skalním podloží</t></is></c></row></sheetData></worksheet>'});
  const files=await zip({'vyzva.txt':due,'reference.docx':word,'rozpocet.xlsx':workbook,'vykres.dwg':'x'});
  const requests:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async (input:URL)=>{
   requests.push(input.href);
   if (input.origin==='https://resolver.example') return manifest([{name:'prilohy.zip',downloadUrl:'https://nen.nipez.cz/prilohy.zip'}]);
   return new Response(files.slice().buffer);
  }));
  const events:NenAnalysisEvent[]=[];
  const model=vi.fn(async (_system:string, input:string)=>{
   expect(input).toContain('Doložte dvě reference');
   expect(input).toContain('A3 Výkop ve skalním podloží');
   return {findings:[
    {...aiFinding,evidence:[{documentId:'F1.1',quote:due}]},
    {...aiFinding,evidence:[{documentId:'F1.1',quote:'Vymyšlená lhůta pro podání.'}]},
    {...aiFinding,category:'conflict',evidence:[{documentId:'F1.1',quote:due}]},
   ]};
  });
  const report=await analyzeNen(reference,{providerUrl:source},model,async event=>{events.push(event);},new AbortController().signal);
  expect(nenAnalysisSchema.safeParse(report).success).toBe(true);
  expect(new URL(requests[0]).searchParams.get('reference')).toBe(reference);
  expect(report.rejectedFindings).toBe(2);
  expect(report.findings).toHaveLength(1);
  expect(report.findings[0].evidence[0].quote).toBe(due);
  expect(report.bibliography[0].version).toMatch(/^[a-f0-9]{64}$/);
  expect(report.files.map(file=>file.status)).toEqual(['read','read','read','unreadable']);
  expect(events.at(-1)).toMatchObject({type:'progress',stage:'verifying'});
 });

 it('reports blocked redirects and an incomplete manifest without contacting an unapproved host',async()=>{
  const fetch=vi.fn(async (input:URL)=>{
   if(input.origin==='https://resolver.example') return manifest([{name:'vyzva.pdf',downloadUrl:'https://nen.nipez.cz/priloha'}],false);
   return new Response(null,{status:302,headers:{location:'https://unapproved.example/file'}});
  });
  vi.stubGlobal('fetch',fetch);
  const model=vi.fn();
  const report=await analyzeNen(reference,{providerUrl:source},model,async()=>{},new AbortController().signal);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(model).not.toHaveBeenCalled();
  expect(report.files[0]).toMatchObject({status:'unreadable',notes:['Soubor je mimo schválený zdroj.']});
  expect(report.gaps).toContain('Zdroj nepotvrdil úplnost seznamu příloh a vysvětlení.');
 });

 it('keeps PDF page locators when reading the text layer',async()=>{
  const stream='BT /F1 14 Tf 25 120 Td (Bid deadline 18 December 2026) Tj ET';
  const objects=[
   '<</Type /Catalog /Pages 2 0 R>>',
   '<</Type /Pages /Count 1 /Kids [3 0 R]>>',
   '<</Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>>',
   '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>',
   `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  ];
  let pdf='%PDF-1.4\n';
  const offsets=[];
  for (const [i,object] of objects.entries()) {
   offsets.push(pdf.length);
   pdf += `${i+1} 0 obj\n${object}\nendobj\n`;
  }
  const entry=pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Root 1 0 R /Size 6>>\nstartxref\n${entry}\n%%EOF\n`;
  const files=await readAttachment('vyzva.pdf',new TextEncoder().encode(pdf));
  expect(files[0].parts).toEqual([{locator:'Strana 1',content:'Bid deadline 18 December 2026'}]);
 });

 it('fails closed when live source or rate limiting is unavailable',async()=>{
  const response=await worker.fetch(
   new Request('https://tendr.example/api/nen/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference})}),
   {ASSETS:{fetch:async()=>new Response()}},
   {waitUntil:vi.fn()},
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({message:expect.stringContaining('schváleného zdroje příloh NEN')});
 });
});
