import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
 ArrowRight, ArrowUpRight, Check, ChevronDown, CircleAlert, Download, FileCheck2,
 FilePenLine, FileText, ListChecks, LoaderCircle, Search, ShieldAlert, TriangleAlert,
} from 'lucide-react';
import { nenAnalysisEventSchema, referenceSchema, type NenAnalysis, type NenAnalysisEvent, type NenFinding } from '@tendr/schemas';
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
const monthFormat = new Intl.DateTimeFormat('cs-CZ',{month:'long',year:'numeric',timeZone:'Europe/Prague'});
type AnalysisProgress = Extract<NenAnalysisEvent,{type:'progress'}>;
type CreateOffer = (report:NenAnalysis)=>void;
const stages = ['Dohledání','Podklady','Analýza','Ověření citací'];
const stageIndex: Record<AnalysisProgress['stage'],number> = {locating:0,downloading:1,reading:1,analyzing:2,verifying:3};

class AnalysisRequestError extends Error {
 constructor(message:string,readonly status:number) {super(message);}
}

async function requestAnalysis(reference:string, signal:AbortSignal, onProgress:(progress:AnalysisProgress)=>void) {
 const response = await fetch('/api/nen/analysis',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({reference}),
  signal,
 });
 if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
  const body: unknown = await response.json().catch(()=>null);
  const message = body && typeof body==='object' && 'message' in body && typeof body.message==='string' ? body.message : genericError;
  throw new AnalysisRequestError(message,response.status);
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
    onProgress(event);
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

function searchable(value:string) {
 return value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('cs-CZ');
}

function DocumentPanel({id,report,unreadOnly,onChange}:{id:string;report:NenAnalysis;unreadOnly:boolean;onChange:(unreadOnly:boolean)=>void}) {
 const read = report.files.filter(file=>file.status==='read').length;
 const total = report.files.length;
 const visible = unreadOnly ? report.files.filter(file=>file.status!=='read') : report.files;

 return <aside className="nen-report-aside" aria-label="Zdroje a kontrola podkladů">
  <section className="nen-file-list" id={id} aria-labelledby={`${id}-heading`}>
   <div className="nen-side-title">
    <span className="nen-side-icon"><FileCheck2 size={19}/></span>
    <div><h3 id={`${id}-heading`}>Přehled souborů</h3><p>{read} z {total} plně zpracováno</p></div>
   </div>
   {total>0&&<>
    <meter className="nen-document-meter" aria-label="Plně zpracované soubory" min={0} max={total} value={read}/>
    <div className="nen-doc-tabs" role="group" aria-label="Zobrazené soubory">
     <button type="button" aria-pressed={!unreadOnly} onClick={()=>onChange(false)}>Všechny <span>{total}</span></button>
     <button type="button" aria-pressed={unreadOnly} onClick={()=>onChange(true)}>K dočtení <span>{total-read}</span></button>
    </div>
   </>}
   {visible.length>0?<ul className="nen-files">
    {visible.map(file=><li key={file.id}>
     <FileText size={15} className="nen-file-icon"/>
     <div>
      <strong>{file.name}</strong>
      <span className={`nen-file-status is-${file.status}`}>{fileStatus[file.status]}</span>
      {file.notes.length>0&&<p>{file.notes.join(' ')}</p>}
     </div>
    </li>)}
   </ul>:<p className="nen-file-empty">{unreadOnly?'Všechny soubory jsou zpracované.':'Pro tento výsledek nejsou dostupné soubory.'}</p>}
  </section>
  {(read<total||report.gaps.length>0)&&<section className="nen-warning" aria-labelledby={`${id}-warning`}>
   <TriangleAlert size={21}/>
   <div>
    <h3 id={`${id}-warning`}>Co ověřit před podáním</h3>
    {read<total&&<p>Podrobnosti k neúplným přílohám najdete v přehledu souborů.</p>}
    {report.gaps.length>0&&<ul>{report.gaps.map((gap,index)=><li key={index}>{gap}</li>)}</ul>}
   </div>
  </section>}
 </aside>;
}

export function NenReport({report,onCreateOffer,sample=false}:{report:NenAnalysis;onCreateOffer:CreateOffer;sample?:boolean}) {
 const id = useId();
 const [category,setCategory] = useState<NenFinding['category']|'all'>('all');
 const [priority,setPriority] = useState<NenFinding['severity']|'all'>('all');
 const [query,setQuery] = useState('');
 const [unreadOnly,setUnreadOnly] = useState(false);
 const critical = report.findings.filter(finding=>finding.severity==='critical').length;
 const high = report.findings.filter(finding=>finding.severity==='high').length;
 const unresolved = report.files.filter(file=>file.status!=='read').length;
 const citations = new Map(report.bibliography.map(source=>[source.id,source]));
 const knownCategories = Object.keys(categories).filter(key=>report.findings.some(finding=>finding.category===key)) as NenFinding['category'][];
 const term = searchable(query.trim());
 const filtered = report.findings.filter(finding=>{
  if ((category!=='all'&&finding.category!==category)||(priority!=='all'&&finding.severity!==priority)) return false;
  const content = [finding.title,finding.requirement,finding.impact,finding.action,...finding.evidence.map(evidence=>evidence.quote)];
  return !term||content.some(text=>searchable(text).includes(term));
 });
 const nenUrl = `https://nen.nipez.cz/verejne-zakazky/detail-zakazky/${report.reference.replaceAll('/','-')}`;
 const hasFilters = category!=='all'||priority!=='all'||Boolean(query);

 function clearFilters() {
  setCategory('all');
  setPriority('all');
  setQuery('');
 }

 return <article className="nen-report" aria-labelledby={`${id}-heading`}>
  <header className="nen-report-head">
   <div className="nen-report-title">
    {sample?<span className="nen-report-sample">Ukázková analýza</span>:<a className="nen-portal-link" href={nenUrl} target="_blank" rel="noreferrer">{report.reference} v NEN <ArrowUpRight size={15}/></a>}
    <h2 id={`${id}-heading`}>{report.title}</h2>
    <div className="nen-report-meta">
     {report.authority&&<span>{report.authority}</span>}
     <span>Zpracováno <time dateTime={report.checkedAt}>{checkedAtFormat.format(new Date(report.checkedAt))}</time></span>
    </div>
   </div>
   <div className="nen-report-actions">
    <button type="button" className="primary nen-create-offer" onClick={()=>onCreateOffer(report)}><FilePenLine size={18}/> Vytvořit nabídku <ArrowRight size={17}/></button>
    <button type="button" className="secondary" onClick={()=>saveReport(report)}><Download size={16}/> Stáhnout výsledky</button>
   </div>
  </header>
  <div className="nen-totals" aria-label="Souhrn analýzy">
   <button type="button" className="nen-stat nen-stat--critical" aria-pressed={priority==='critical'} onClick={()=>setPriority(priority==='critical'?'all':'critical')}>
    <span className="nen-stat-icon"><ShieldAlert size={19}/></span><span><strong>{critical}</strong>Kritická zjištění</span>
   </button>
   <button type="button" className="nen-stat nen-stat--high" aria-pressed={priority==='high'} onClick={()=>setPriority(priority==='high'?'all':'high')}>
    <span className="nen-stat-icon"><TriangleAlert size={19}/></span><span><strong>{high}</strong>Vysoká priorita</span>
   </button>
   <button type="button" className="nen-stat" onClick={clearFilters} aria-label={`Zobrazit všechna zjištění s citací (${report.findings.length})`}>
    <span className="nen-stat-icon"><ListChecks size={19}/></span><span><strong>{report.findings.length}</strong>Zjištění s citací</span>
   </button>
   <a className="nen-stat" href={`#${id}-documents`} onClick={()=>setUnreadOnly(true)}>
    <span className="nen-stat-icon"><FileText size={19}/></span><span><strong>{unresolved}</strong>Souborů k dočtení</span>
   </a>
  </div>
  <div className="nen-report-grid">
   <section className="nen-findings-panel" aria-labelledby={`${id}-findings`}>
    <div className="nen-findings-head">
     <div><h3 id={`${id}-findings`}>Zjištění a další kroky</h3><p role="status">Zobrazeno {filtered.length} z {report.findings.length}</p></div>
     {report.findings.length>0&&<label className="nen-search">
      <Search size={17}/><span className="sr-only">Hledat ve zjištěních</span><input type="search" placeholder="Hledat ve zjištěních" value={query} onChange={event=>setQuery(event.target.value)}/>
     </label>}
    </div>
    {knownCategories.length>0&&<div className="nen-filters" role="group" aria-label="Oblasti zjištění">
     <button type="button" aria-pressed={category==='all'} onClick={()=>setCategory('all')}>Všechny oblasti</button>
     {knownCategories.map(item=><button key={item} type="button" aria-pressed={category===item} onClick={()=>setCategory(item)}>{categories[item]}</button>)}
     {hasFilters&&<button type="button" className="nen-clear-filters" onClick={clearFilters}>Zrušit filtry</button>}
    </div>}
    <div className="nen-findings">
     {filtered.length===0&&<div className="nen-findings-empty">
      <CircleAlert size={23}/><div><strong>{hasFilters?'Žádná zjištění pro zvolený filtr':'Bez ověřených zjištění'}</strong>
       <p>{hasFilters?'Zkuste jiné hledání nebo upravte výběr.':'V přehledu souborů zjistíte, které podklady je potřeba ověřit ručně.'}</p></div>
     </div>}
     {filtered.map(finding=><section key={finding.id} className={`nen-finding nen-${finding.severity}`}>
      <p className="nen-finding-meta"><strong>{severity[finding.severity]}</strong><span>{categories[finding.category]}</span></p>
      <h4>{finding.title}</h4>
      <dl>
       <div><dt>Požadavek</dt><dd>{finding.requirement}</dd></div>
       <div><dt>Dopad</dt><dd>{finding.impact}</dd></div>
       <div className="nen-finding-action"><dt><Check size={16}/> Co udělat</dt><dd>{finding.action}</dd></div>
      </dl>
      <div className="nen-evidence">
       <p>Citace z dokumentace</p>
       {finding.evidence.map((evidence,index)=><details key={index} className="nen-quote">
        <summary><FileText size={16}/><span>{citations.get(evidence.documentId)?.name??evidence.documentId} · {evidence.locator}</span><ChevronDown size={16}/></summary>
        <blockquote>{evidence.quote}</blockquote>
       </details>)}
      </div>
     </section>)}
    </div>
   </section>
   <DocumentPanel id={`${id}-documents`} report={report} unreadOnly={unreadOnly} onChange={setUnreadOnly}/>
  </div>
 </article>;
}

interface NenIntakeProps {
 onCreateOffer:CreateOffer;
 onOpenAccount?:()=>void;
 onOpenPricing?:()=>void;
 onAnalysisFinished?:()=>void;
}

export function NenIntake({onCreateOffer,onOpenAccount,onOpenPricing,onAnalysisFinished}:NenIntakeProps) {
 const [reference,setReference] = useState('');
 const [available,setAvailable] = useState<boolean|null>(null);
 const [indexedThrough,setIndexedThrough] = useState<string|null>(null);
 const [progress,setProgress] = useState<AnalysisProgress|null>(null);
 const [error,setError] = useState<{message:string;reference?:string;status?:number}|null>(null);
 const [report,setReport] = useState<NenAnalysis|null>(null);
 const active = useRef<AbortController|null>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>{
  const controller = new AbortController();
  void fetch('/api/nen/analysis',{signal:controller.signal})
   .then(response=>response.json())
   .then((state:unknown)=>{
    if (controller.signal.aborted) return;
    if (!state||typeof state!=='object'||!('available'in state)) {setAvailable(false);return;}
    setAvailable(state.available===true);
    if ('coverage'in state&&state.coverage&&typeof state.coverage==='object'&&'through'in state.coverage
      &&typeof state.coverage.through==='string'&&/^20\d\d-(0[1-9]|1[0-2])$/.test(state.coverage.through)) {
     setIndexedThrough(state.coverage.through);
    }
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
  setProgress({type:'progress',stage:'locating',detail:'Spouštíme analýzu zakázky.'});
  try {
   setReport(await requestAnalysis(parsed.data,controller.signal,setProgress));
  } catch (failure) {
   if (!controller.signal.aborted) setError({
    reference:parsed.data,
    message:failure instanceof Error && !(failure instanceof SyntaxError) && failure.name!=='ZodError' ? failure.message : genericError,
    status:failure instanceof AnalysisRequestError ? failure.status : undefined,
   });
  } finally {
   active.current = null;
   if (!controller.signal.aborted) {
    setProgress(null);
    onAnalysisFinished?.();
   }
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
  {available===true&&indexedThrough&&<p className="nen-availability">Nejnovější export v indexu ISVZ je za {monthFormat.format(new Date(`${indexedThrough}-01T12:00:00Z`))}. Přílohy načítáme z aktuálního veřejného XML profilu zadavatele.</p>}
  {progress&&<div className="nen-progress">
   <ol aria-label="Průběh analýzy">
    {stages.map((stage,index)=><li key={stage} aria-current={index===stageIndex[progress.stage]?'step':undefined} data-done={index<stageIndex[progress.stage]}>
     {index<stageIndex[progress.stage]?<Check size={14}/>:<span aria-hidden="true"/>}{stage}
    </li>)}
   </ol>
   <p role="status"><LoaderCircle className="spin" size={17}/>{progress.detail}</p>
  </div>}
  {error&&(error.status===401||error.status===402?<div className="nen-form-message">
   <p role="alert">{error.message}</p>
   {error.status===401&&onOpenAccount&&<button type="button" className="primary" onClick={onOpenAccount}>Přihlásit se <ArrowRight size={17}/></button>}
   {error.status===402&&(onOpenPricing?<button type="button" className="primary" onClick={onOpenPricing}>Koupit kredit <ArrowRight size={17}/></button>:<a className="primary" href="#pricing">Zobrazit ceník <ArrowRight size={17}/></a>)}
  </div>:<div className="error" role="alert">
   {error.message}
   {error.reference&&<a className="nen-portal-link" href={`https://nen.nipez.cz/verejne-zakazky/detail-zakazky/${error.reference.replaceAll('/','-')}`} target="_blank" rel="noreferrer">Zobrazit detail v NEN <ArrowUpRight size={15}/></a>}
  </div>)}
  {report&&<NenReport key={report.checkedAt} report={report} onCreateOffer={onCreateOffer}/>}
 </div>;
}
