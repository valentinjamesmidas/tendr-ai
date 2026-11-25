import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, CircleAlert, Download, FileText, LoaderCircle, Search } from 'lucide-react';
import { nenAnalysisEventSchema, referenceSchema, type NenAnalysis, type NenFinding } from '@tendr/schemas';
import './nen-analysis.css';

const categories: Record<NenFinding['category'],string> = {
 submission:'Podání a lhůty',
 qualification:'Kvalifikace',
 attachments:'Formuláře a přílohy',
 evaluation:'Cena a hodnocení',
 contract:'Smlouva a sankce',
 technical:'Technické podmínky',
 conflict:'Rozpory a změny',
};
const severity = {critical:'Kritické',high:'Vysoká priorita',medium:'Střední priorita',low:'Nízká priorita'};
const fileStatus = {read:'Zpracováno',partial:'Částečně',unreadable:'Nezpracováno'};
const genericError = 'Služba analýzy je dočasně nedostupná.';
const checkedAtFormat = new Intl.DateTimeFormat('cs-CZ',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Prague'});

async function requestAnalysis(reference:string, signal:AbortSignal, onProgress:(detail:string)=>void) {
 const response = await fetch('/api/nen/analysis',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({reference}),
  signal,
 });
 if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
  const body: unknown = await response.json().catch(()=>null);
  throw new Error(body && typeof body==='object' && 'message' in body && typeof body.message==='string' ? body.message : genericError);
 }
 if (!response.body) throw new Error(genericError);
 const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
 let partial = '';
 try {
  while (true) {
   const {value,done} = await reader.read();
   const lines = (partial + (value??'')).split('\n');
   partial = done ? '' : lines.pop() ?? '';
   for (const line of lines) {
    if (!line.trim()) continue;
    const event = nenAnalysisEventSchema.parse(JSON.parse(line));
    if (event.type==='error') throw new Error(event.message);
    if (event.type==='result') {
     if (event.report.reference!==reference) throw new Error('Výsledky neodpovídají zadanému číslu NEN.');
     return event.report;
    }
    onProgress(event.detail);
   }
   if (done) throw new Error('Spojení se přerušilo před dokončením analýzy.');
  }
 } finally {
  await reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
}

function saveReport(report:NenAnalysis) {
 const blob = new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `analyza-${report.reference.replaceAll('/','-')}.json`;
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function NenReport({report}:{report:NenAnalysis}) {
 const [category,setCategory] = useState<NenFinding['category']|'all'>('all');
 const critical = report.findings.filter(finding=>finding.severity==='critical').length;
 const high = report.findings.filter(finding=>finding.severity==='high').length;
 const unresolved = report.files.filter(file=>file.status!=='read').length;
 const citations = new Map(report.bibliography.map(source=>[source.id,source]));
 const knownCategories = Object.keys(categories).filter(key=>report.findings.some(finding=>finding.category===key)) as NenFinding['category'][];
 const filtered = report.findings.filter(finding=>category==='all'||finding.category===category);
 const nenUrl = `https://nen.nipez.cz/verejne-zakazky/detail-zakazky/${report.reference.replaceAll('/','-')}`;

 return <article className="nen-report" aria-labelledby="analysis-title">
  <header className="nen-report-head">
   <div>
    <a className="nen-portal-link" href={nenUrl} target="_blank" rel="noreferrer">{report.reference} v NEN <ArrowUpRight size={15}/></a>
    <h2 id="analysis-title">{report.title}</h2>
    {report.authority&&<p>{report.authority}</p>}
    <p>Zpracováno <time dateTime={report.checkedAt}>{checkedAtFormat.format(new Date(report.checkedAt))}</time></p>
   </div>
   <button className="secondary" onClick={()=>saveReport(report)}><Download size={15}/> Stáhnout výsledky</button>
  </header>
  <div className="nen-totals">
   <div><strong>{critical}</strong><span>Kritická zjištění</span></div>
   <div><strong>{high}</strong><span>Vysoká priorita</span></div>
   <div><strong>{report.findings.length}</strong><span>Zjištění s citací</span></div>
   <div><strong>{unresolved}</strong><span>Souborů k dočtení</span></div>
  </div>
  {(unresolved>0||report.gaps.length>0)&&<section className="nen-warning">
   <CircleAlert size={22}/>
   <div>
    <h3>Co ještě ověřit před podáním</h3>
    {unresolved>0&&<p>Část příloh se nepodařilo zpracovat v plném rozsahu. Podrobnosti jsou v přehledu souborů.</p>}
    {report.gaps.length>0&&<ul>{report.gaps.map(gap=><li key={gap}>{gap}</li>)}</ul>}
   </div>
  </section>}
  <section aria-label="Zjištění se zdroji">
   <h3>Požadavky, rizika a další kroky</h3>
   {knownCategories.length>0&&<div className="filters nen-filters">
    <button type="button" className={category==='all'?'active':''} aria-pressed={category==='all'} onClick={()=>setCategory('all')}>Vše</button>
    {knownCategories.map(item=><button key={item} type="button" className={category===item?'active':''} aria-pressed={category===item} onClick={()=>setCategory(item)}>{categories[item]}</button>)}
   </div>}
   <div className="nen-findings">
    {filtered.length===0&&<p>Analýza nevrátila žádná ověřená zjištění.</p>}
    {filtered.map(finding=><section key={finding.id} className={`nen-finding nen-${finding.severity}`}>
     <p className="nen-finding-meta"><strong>{severity[finding.severity]}</strong><span>{categories[finding.category]}</span></p>
     <h4>{finding.title}</h4>
     <dl>
      <div><dt>Požadavek</dt><dd>{finding.requirement}</dd></div>
      <div><dt>Dopad</dt><dd>{finding.impact}</dd></div>
      <div><dt>Co udělat</dt><dd>{finding.action}</dd></div>
     </dl>
     {finding.evidence.map((evidence,index)=><details key={index} className="nen-quote">
      <summary><FileText size={15}/> {citations.get(evidence.documentId)?.name} · {evidence.locator}</summary>
      <blockquote>{evidence.quote}</blockquote>
     </details>)}
    </section>)}
   </div>
  </section>
  <section className="nen-file-list">
   <h3>Přehled souborů</h3>
   <ul>{report.files.map(file=><li key={file.id}>
    <strong>{file.name}</strong><span className={`nen-file-status is-${file.status}`}>{fileStatus[file.status]}</span>
    {file.notes.length>0&&<p>{file.notes.join(' ')}</p>}
   </li>)}</ul>
  </section>
 </article>;
}

export function NenIntake() {
 const [reference,setReference] = useState('');
 const [available,setAvailable] = useState<boolean|null>(null);
 const [progress,setProgress] = useState('');
 const [error,setError] = useState<{message:string;reference?:string}|null>(null);
 const [report,setReport] = useState<NenAnalysis|null>(null);
 const active = useRef<AbortController|null>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>{
  const controller = new AbortController();
  void fetch('/api/nen/analysis',{signal:controller.signal})
   .then(response=>response.json())
   .then((state:unknown)=>{
    if (!controller.signal.aborted) setAvailable(Boolean(state&&typeof state==='object'&&'available'in state&&state.available===true));
   })
   .catch(()=>{if (!controller.signal.aborted) setAvailable(false);});
  return ()=>controller.abort();
 },[]);

 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (active.current) return;
  const parsed = referenceSchema.safeParse(reference.trim().toUpperCase().replaceAll('-','/'));
  if (!parsed.success) {
   setReport(null);
   setError({message:'Zadejte číslo ve formátu N006/26/V00018665.'});
   return;
  }
  const controller = new AbortController();
  active.current = controller;
  setError(null);
  setReport(null);
  setProgress('Spouštíme analýzu zakázky.');
  try {
   setReport(await requestAnalysis(parsed.data,controller.signal,setProgress));
  } catch (failure) {
   if (!controller.signal.aborted) setError({
    reference:parsed.data,
    message:failure instanceof Error && !(failure instanceof SyntaxError) && failure.name!=='ZodError' ? failure.message : genericError,
   });
  } finally {
   active.current = null;
   if (!controller.signal.aborted) setProgress('');
  }
 }

 return <div className="nen-intake">
  <form className="reference-form" onSubmit={submit}>
   <label htmlFor="reference">Číslo veřejné zakázky</label>
   <div className="reference-field">
    <div className="reference-input"><Search size={18}/><input id="reference" value={reference} onChange={event=>setReference(event.target.value)} placeholder="N006/26/V00018665" autoComplete="off" maxLength={20} disabled={!!progress}/></div>
    <button className="primary" type="submit" disabled={!!progress}>Zanalyzovat zakázku <ArrowRight size={17}/></button>
   </div>
  </form>
  {available===false&&<p className="nen-availability">Živá analýza čeká na připojení zdroje příloh. <a href="#ukazky">Vyzkoušejte ukázku.</a></p>}
  {progress&&<p className="nen-progress" role="status"><LoaderCircle className="spin" size={18}/>{progress}</p>}
  {error&&<div className="error" role="alert">
   {error.message}
   {error.reference&&<a className="nen-portal-link" href={`https://nen.nipez.cz/verejne-zakazky/detail-zakazky/${error.reference.replaceAll('/','-')}`} target="_blank" rel="noreferrer">Zobrazit detail v NEN <ArrowUpRight size={15}/></a>}
  </div>}
  {report&&<NenReport key={report.checkedAt} report={report}/>}
 </div>;
}
