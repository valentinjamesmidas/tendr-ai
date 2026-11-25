import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { ArrowUpRight, ArrowRight, FileText, ShieldCheck, Building2, Check, CheckCircle2, ChevronRight, Download, X, CircleAlert, Layers3, Calculator, LayoutDashboard, ListChecks, MessageSquareText, FolderOpen, ExternalLink, LoaderCircle, Copy, Printer } from 'lucide-react';
import { fixtures, normalizeReference, formatMoney, runAudit, calculateExposure } from '@tendr/domain';
import type { Tender, SourceDocument } from '@tendr/schemas';
import { createOfferDraft, getOfferRequirements } from './offer-draft';
import { OfferPackage } from './offer-package';
import { Landing } from './landing';
import './styles.css';

const offerPriceMinor = 999_900;
const offerPrice = new Intl.NumberFormat('cs-CZ', {
 style: 'currency',
 currency: 'CZK',
 maximumFractionDigits: 0,
}).format(offerPriceMinor / 100);

const categories: Record<string,string> = {all:'Všechny oblasti',financial:'Finanční',legal:'Smluvní',technical:'Technická',chronological:'Termíny',qualification:'Kvalifikace',conflict:'Rozpory'};
const severity: Record<string,string> = {critical:'Kritické',high:'Vysoké',medium:'Střední',low:'Nízké'};
const tabs = [{id:'offer',label:'Balíček nabídky',icon:FileText},{id:'overview',label:'Analýza podkladů',icon:LayoutDashboard},{id:'qualification',label:'Kvalifikace',icon:ListChecks},{id:'documents',label:'Dokumentace',icon:FolderOpen},{id:'clarification',label:'Dotazy zadavateli',icon:MessageSquareText},{id:'checklist',label:'Checklist nabídky',icon:CheckCircle2}];
const checklistItems = (t:Tender, requirements:ReturnType<typeof getOfferRequirements>) => ['Prostudovat všechny verze zadávací dokumentace','Ověřit aktuální lhůtu, vysvětlení zadávací dokumentace a způsob podání',...t.qualification.map(q=>`Doložit – ${q.requirement}`),...requirements.filter(r=>r.kind==='attachment').flatMap(r=>r.evidence.map(e=>e.quote)),'Vyjasnit rozpory a doplnit chybějící podklady','Doplnit cenu plnění a zkontrolovat formuláře zadavatele','Zkontrolovat kompletnost a podpis nabídky'];
const deadlineFormat = new Intl.DateTimeFormat('cs-CZ',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Prague'});
const date = (s:string) => new Intl.DateTimeFormat('cs-CZ',{dateStyle:'long'}).format(new Date(s));
function download(name:string,content:string,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function App(){
 const navigate=useNavigate();const location=useLocation();const [input,setInput]=useState('');const [error,setError]=useState('');
 const ref=new URLSearchParams(location.search).get('reference');const tender=fixtures.find((t:Tender)=>t.reference===ref);
 const [tab,setTab]=useState('offer');const [filter,setFilter]=useState('all');const [paywall,setPaywall]=useState(false);const [source,setSource]=useState<SourceDocument|null>(null);const [days,setDays]=useState(30);const [checked,setChecked]=useState<string[]>([]);const [draft,setDraft]=useState('');const [copied,setCopied]=useState(false);
 const [editedOffer,setEditedOffer]=useState<string|null>(null);
 const [reviewed,setReviewed]=useState(false);
 const audit=useMutation({
  mutationFn:async (t:Tender)=>{
   const report=await runAudit(t);
   const requirements=getOfferRequirements(t,report);
   return {report,requirements,offer:createOfferDraft(t,requirements)};
  },
 });
 const {reset:resetAudit}=audit;
 const result=audit.data?.report.reference===ref?audit.data:null;
 const report=result?.report;
 const offer=editedOffer??result?.offer??'';
 const checklist=tender&&result?checklistItems(tender,result.requirements):[];

 function openTender(value:string){try{const normalized=normalizeReference(value);if(!fixtures.some((t:Tender)=>t.reference===normalized))throw new Error('V demo režimu jsou dostupné pouze níže uvedené syntetické zakázky.');setError('');setInput(normalized);navigate(`/?reference=${encodeURIComponent(normalized)}`);window.scrollTo(0,0);}catch(e){setError(e instanceof Error?e.message:'Zadejte platné číslo zakázky.');}}
 function home(){
  navigate('/');
  setError('');
  setInput('');
  window.scrollTo(0,0);
 }
 useEffect(()=>{
  if(!ref&&location.hash){
   document.getElementById(location.hash.slice(1))?.scrollIntoView?.();
  }
 },[location.hash,location.key,ref]);
 useEffect(()=>{
  resetAudit();
  setSource(null);setPaywall(false);setEditedOffer(null);setReviewed(false);setDraft('');setChecked([]);
  setCopied(false);setFilter('all');setDays(30);setTab('offer');
 },[ref,resetAudit]);
 useEffect(()=>{if(!source&&!paywall)return;const previous=document.activeElement as HTMLElement|null;const timer=setTimeout(()=>document.querySelector<HTMLElement>('[role=dialog] button')?.focus(),0);const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!audit.isPending){setPaywall(false);setSource(null);}if(e.key==='Tab'){const nodes=Array.from(document.querySelectorAll<HTMLElement>('[role=dialog] button:not([disabled]),[role=dialog] textarea,[role=dialog] input'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{clearTimeout(timer);document.removeEventListener('keydown',keydown);previous?.focus();};},[source,paywall,audit.isPending]);
 const calculation=tender?calculateExposure({valueMinor:tender.valueMinor,penaltyBps:tender.penaltyBps,retentionBps:tender.retentionBps,days}):null;
 function generateDraft(){if(!tender||!report)return;setDraft(`Věc: Žádost o vysvětlení zadávací dokumentace – ${tender.reference}\n\nVážení,\n\nv souvislosti se zakázkou „${tender.title}“ si dovolujeme požádat o vysvětlení následujících bodů zadávací dokumentace:\n\n${report.findings.map((f,i)=>`${i+1}. ${f.title}\n${f.action}\nPodklad: ${f.evidence.map(e=>`${tender.documents.find(d=>d.id===e.documentId)?.name ?? e.documentId}, ${e.locator}: „${e.quote}“`).join('; ')}`).join('\n\n')}\n\nDěkujeme za upřesnění.\n\n[Jméno a společnost]\n\nPRACOVNÍ NÁVRH – syntetická demo data. Před odesláním ověřte věcnou správnost, právní základ a lhůtu. Tento návrh nebyl odeslán.`);setTab('clarification');}
 return <>
 <header className="topbar">
  <div className="topbar-inner">
   <button className="brand" onClick={home} aria-label="tendr.ai úvod"><span className="brand-mark"><Layers3 size={20}/></span>tendr<span>.ai</span></button>
   <nav aria-label="Hlavní navigace">
    <Link to="/#postup">Jak to funguje</Link>
    <Link to="/#ukazky">Ukázkové zakázky</Link>
    <Link to="/#pricing">Ceník</Link>
   </nav>
   <Link className="primary header-cta" to="/#ukazky">Otevřít demo <ArrowUpRight size={16}/></Link>
  </div>
 </header>
 {tender&&<div className="demo-banner"><ShieldCheck size={14}/><span>Ukázková data. Platba i kontrola specialistkou jsou simulované.</span></div>}
 {!tender?<Landing
  price={offerPrice}
  reference={input}
  invalidReference={!!ref}
  error={error}
  onReferenceChange={setInput}
  onOpenTender={openTender}
 />:<main className={report&&tab==='offer'&&reviewed?'workspace offer-print-view':'workspace'}><div className="breadcrumb"><button onClick={home}>Zakázky</button><ChevronRight size={13}/><span>{tender.reference}</span><span className="tag demo-tag">Syntetická ukázka</span></div><section className="tender-heading"><div><div className="eyebrow">{tender.sector==='construction'?'STAVEBNÍ PRÁCE':'IT A TECHNOLOGIE'}</div><h1>{tender.title}</h1><p><Building2 size={15}/>{tender.authority}<span className="dot">·</span><span className="mono">{tender.reference}</span></p></div><div className="heading-actions">{report?<><button className="secondary" onClick={()=>download(`audit-${tender.reference.replaceAll('/','-')}.json`,JSON.stringify({tender,report},null,2),'application/json')}><Download size={16}/> Export JSON</button>{(tab!=='offer'||reviewed)&&<button className="primary" onClick={()=>window.print()}><Printer size={16}/> Tisk sekce / PDF</button>}</>:<button className="primary" onClick={()=>setPaywall(true)}>Připravit ukázkovou nabídku <ArrowRight size={17}/></button>}</div></section>
 {error&&<p role="alert" className="error">{error}</p>}
 <div className="summary-grid"><div className="metric"><span>Předpokládaná hodnota</span><strong>{formatMoney(tender.valueMinor)}</strong><small>Bez DPH · syntetický údaj</small></div><div className="metric"><span>Lhůta pro podání nabídky</span><strong>{deadlineFormat.format(new Date(tender.deadline))}</strong><small>Ukázkový termín</small></div><div className="metric"><span>Zadávací dokumentace</span><strong>{tender.documents.length} dokumenty</strong><small><CheckCircle2 size={12}/> Připravené demo podklady</small></div><div className="metric"><span>{report?'Ověření citovaných pasáží':'Stav nabídky'}</span><strong className={report?'green':''}>{report?`${report.verification.passed} / ${report.verification.total}`:'Připraveno ke zpracování'}</strong><small>{report?'Nedokládá správnost právního výkladu':'Návrh ještě nebyl vytvořen'}</small></div></div>
 {!report?<section className="preview-layout"><div className="panel"><div className="panel-title"><FolderOpen size={19}/><h2>Dostupná dokumentace</h2><span className="count">{tender.documents.length}</span></div><p className="panel-copy">Z těchto podkladů vychází návrh nabídky i přehled požadavků.</p>{tender.documents.map(d=><button className="document-row" key={d.id} onClick={()=>setSource(d)}><span className="file-icon"><FileText size={19}/></span><span><strong>{d.name}</strong><small>Verze {d.version} · syntetický zdroj</small></span><ExternalLink size={16}/></button>)}</div><aside className="panel audit-promo"><span className="sector-icon"><ShieldCheck size={25}/></span><h2>Co získáte k nabídce</h2>{['Matice požadavků s citacemi','Pracovní formuláře a kontrolní seznam','Podklady k vyjasnění se zadavatelem','Ukázka kontroly a předání balíčku'].map(x=><div className="check-line" key={x}><Check size={16}/>{x}</div>)}<button className="primary full" onClick={()=>setPaywall(true)}>Spustit ukázku <ArrowRight size={16}/></button><small>{offerPrice} za nabídku · ukázka zdarma</small></aside></section>:<><div className="tabs" role="tablist" aria-label="Sekce přípravy nabídky">{tabs.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)} className={tab===t.id?'active':''}><t.icon size={16}/>{t.label}</button>)}</div>
 {tab==='offer'&&result&&<OfferPackage
  requirements={result.requirements}
  documents={tender.documents}
  reviewed={reviewed}
  onReview={()=>setReviewed(true)}
  onOpenSource={setSource}
  offer={offer}
  onEdit={setEditedOffer}
  onDownload={()=>download(`nabidka-${tender.reference.replaceAll('/','-')}.md`,offer,'text/markdown;charset=utf-8')}
 />}
 {tab==='overview'&&<><section className="verdict"><span className="verdict-icon"><CircleAlert size={25}/></span><div><span className="eyebrow">ZJIŠTĚNÍ PRO PŘÍPRAVU NABÍDKY</span><h2>{report.verdict==='NO-GO'?'Nepokračovat bez vyřešení zásadních rizik':'Pokračovat po vyjasnění podmínek'}</h2><p>Podmíněné doporučení z připravené ukázky. Před rozhodnutím ověřte kvalifikaci a projděte zjištění s odpovědnou osobou.</p></div><span className="status-pill">{report.verdict}</span></section><div className="report-layout"><section><div className="section-line"><div><h2>Zjištění a rizika <span className="count">{report.findings.length}</span></h2><p className="subtle">Každé zjištění se opírá o konkrétní podklad.</p></div></div><div className="filters" aria-label="Filtr rizik">{Object.entries(categories).map(([id,label])=><button key={id} onClick={()=>setFilter(id)} className={filter===id?'active':''}>{label}</button>)}</div><div className="findings">{report.findings.filter(f=>filter==='all'||f.category===filter).map(f=><article className="finding" key={f.id}><div className="finding-meta"><span className={`severity ${f.severity}`}><span/>{severity[f.severity]}</span><span>{categories[f.category]}</span><span className="kind">{f.kind==='calculation'?'Deterministický výpočet':f.kind==='assessment'?'AI posouzení · simulace':'Zdrojový fakt'}</span></div><h3>{f.title}</h3><p>{f.explanation}</p><div className="next-action"><ArrowRight size={15}/><span>{f.action}</span></div><div className="evidence-links">{f.evidence.map((e,i)=><button key={`${e.documentId}-${i}`} onClick={()=>setSource(tender.documents.find(d=>d.id===e.documentId)??null)}><FileText size={13}/>{tender.documents.find(d=>d.id===e.documentId)?.name??e.documentId}<span>{e.locator}</span><ArrowUpRight size={13}/></button>)}</div></article>)}{report.findings.filter(f=>filter==='all'||f.category===filter).length===0&&<div className="empty">V této oblasti demo audit neobsahuje zjištění. Neznamená to potvrzení absence rizik.</div>}</div></section><aside className="report-aside"><section className="panel calculator"><div className="panel-title"><Calculator size={18}/><h2>Finanční scénář</h2></div><p className="panel-copy">Modelový dopad prodlení podle vstupních podmínek. Nejde o předpověď nákladů.</p><label htmlFor="days">Počet dnů prodlení <strong>{days} dnů</strong></label><input id="days" type="range" min="0" max="90" value={days} onChange={e=>setDays(Number(e.target.value))}/><div className="range-labels"><span>0 dnů</span><span>90 dnů</span></div><div className="calc-row"><span>Denní smluvní pokuta</span><strong>{formatMoney(calculation!.dailyPenaltyMinor)}</strong></div><div className="calc-total"><span>Scénář za {days} dnů</span><strong>{formatMoney(calculation!.scenarioPenaltyMinor)}</strong></div><div className="calc-row"><span>Zádržné</span><strong>{formatMoney(calculation!.retentionMinor)}</strong></div><small>Výpočet v haléřích · bez součtu odlišných typů expozice. Základ: {formatMoney(tender.valueMinor)}.</small></section><section className="panel next-panel"><MessageSquareText size={21}/><h3>Vyjasněte nejasnosti včas</h3><p>Připravte upravitelný návrh dotazů s odkazem na zjištění.</p><button className="secondary full" onClick={generateDraft}>Připravit návrh <ArrowRight size={15}/></button></section></aside></div></>}
 {tab==='qualification'&&<section className="panel"><div className="panel-title"><ListChecks size={19}/><h2>Kvalifikační požadavky</h2></div><p className="panel-copy">Firemní profil není doložen. Splnění požadavků nelze automaticky potvrdit.</p><div className="table-scroll"><table><thead><tr><th>Požadavek</th><th>Přesná podmínka</th><th>Stav společnosti</th><th>Podklad</th></tr></thead><tbody>{tender.qualification.map(q=><tr key={q.id}><td><strong>{q.requirement}</strong></td><td>{q.condition}</td><td><span className="missing">Chybí důkaz</span></td><td><button className="text-button" onClick={()=>setSource(tender.documents.find(d=>d.id===q.documentId)??null)}>Zobrazit zdroj <ArrowUpRight size={13}/></button></td></tr>)}</tbody></table></div></section>}
 {tab==='documents'&&<section className="panel"><div className="panel-title"><FolderOpen size={19}/><h2>Dokumenty a verze</h2></div><p className="panel-copy">Soubor dokumentů: <code className="hash">{report.documentSetHash}</code></p>{tender.documents.map(d=><button className="document-row" key={d.id} onClick={()=>setSource(d)}><span className="file-icon"><FileText size={19}/></span><span><strong>{d.name}</strong><small>Verze {d.version} · {d.locator}</small></span><ExternalLink size={16}/></button>)}<button className="secondary" onClick={()=>download('zdrojove-dokumenty.md',tender.documents.map(d=>`# ${d.name}\n\nVerze: ${d.version}\nLokátor: ${d.locator}\n\n${d.content}`).join('\n\n---\n\n'),'text/markdown;charset=utf-8')}><Download size={16}/> Stáhnout zdrojové texty</button></section>}
 {tab==='clarification'&&<section className="panel"><div className="panel-title"><MessageSquareText size={19}/><h2>Návrh žádosti o vysvětlení</h2></div><p className="panel-copy">Pracovní návrh pro lidskou kontrolu. Ověřte vhodnost postupu podle § 98 ZZVZ a lhůtu pro konkrétní zakázku. Žádná zpráva se automaticky neodesílá.</p>{!draft?<button className="primary" onClick={generateDraft}>Vytvořit návrh ze zjištění <ArrowRight size={16}/></button>:<><label className="sr-only" htmlFor="draft">Upravit návrh dotazů</label><textarea id="draft" className="draft" value={draft} onChange={e=>setDraft(e.target.value)}/><div className="button-row"><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(draft);setCopied(true);}catch{setError('Kopírování není dostupné. Označte a zkopírujte text ručně.');}}}><Copy size={16}/>{copied?'Zkopírováno':'Kopírovat'}</button><button className="secondary" onClick={()=>download('navrh-dotazu.txt',draft)}><Download size={16}/> Stáhnout TXT</button></div></>}</section>}
 {tab==='checklist'&&<section className="panel"><div className="panel-title"><CheckCircle2 size={19}/><h2>Checklist přípravy nabídky</h2></div><p className="panel-copy">Váš pracovní postup pro tuto relaci. Zaškrtnutí neověřuje splnění zadávacích podmínek.</p>{checklist.map((item,i)=><label className="checklist-row" key={`${i}-${item}`}><input type="checkbox" checked={checked.includes(String(i))} onChange={()=>setChecked(c=>c.includes(String(i))?c.filter(x=>x!==String(i)):[...c,String(i)])}/><span>{item}</span></label>)}<button className="secondary" onClick={()=>download('checklist.md',`# Checklist – ${tender.reference}\n\nSyntetická ukázka; vyžaduje ruční kontrolu.\n\n${checklist.map((x,i)=>`- [${checked.includes(String(i))?'x':' '}] ${x}`).join('\n')}`,'text/markdown;charset=utf-8')}><Download size={16}/> Export checklistu</button></section>}
 <div className="report-footnote"><ShieldCheck size={16}/><div><strong>Transparentní podklady, odborné rozhodnutí.</strong><p>Zdrojová shoda potvrzuje dohledatelnost pasáže, nikoli správnost právního výkladu. Demo report není právním posudkem. AI: {report.model}; pravidla: {report.ruleVersion}; vytvořeno: {date(report.createdAt)}.</p></div></div></>}
 </main>}
 <footer className="site-footer">
  <button className="brand footer-brand" onClick={home}>tendr<span>.ai</span></button>
  <p>Příprava nabídek pro veřejné zakázky</p>
  <Link to="/#faq">O demo prostředí</Link>
 </footer>
 {paywall&&tender&&<div className="modal-backdrop" onClick={()=>!audit.isPending&&setPaywall(false)}>
  <section className="modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={e=>e.stopPropagation()}>
   <button className="close" aria-label="Zavřít" onClick={()=>setPaywall(false)} disabled={audit.isPending}><X size={21}/></button>
   <span className="sector-icon"><FileText size={25}/></span>
   <h2 id="payment-title">Vytvořit ukázkový návrh nabídky</h2>
   <p>Zpracují se připravené syntetické dokumenty zakázky.</p>
   <div className="payment-price"><span>Příprava jedné nabídky</span><strong>{offerPrice}</strong></div>
   <div className="notice"><CircleAlert size={17}/><span><strong>Simulovaná platba.</strong> Ukázka je zdarma a bez zadávání platebních údajů.</span></div>
   {audit.isError&&<p role="alert" className="error">Návrh se nepodařilo vytvořit. Zkuste to znovu.</p>}
   {audit.isPending?<div role="status" className="processing"><LoaderCircle className="spin" size={21}/><span>Připravujeme návrh nabídky a ověřujeme podklady…</span></div>:
    <button className="primary full" onClick={()=>audit.mutate(tender,{onSuccess:()=>{setPaywall(false);setTab('offer');}})} data-testid="simulate-payment">Vytvořit ukázkový návrh <ArrowRight size={17}/></button>}
  </section>
 </div>}
 {source&&<div className="modal-backdrop" onClick={()=>setSource(null)}><section className="modal source-modal" role="dialog" aria-modal="true" aria-labelledby="source-title" onClick={e=>e.stopPropagation()}><button className="close" aria-label="Zavřít zdroj" onClick={()=>setSource(null)}><X size={21}/></button><div className="eyebrow">INSPEKTOR ZDROJE · SYNTETICKÝ DOKUMENT</div><h2 id="source-title">{source.name}</h2><p className="subtle">Verze {source.version} · {source.locator}</p><pre>{source.content}</pre><button className="secondary" onClick={()=>download(`${source.id}.md`,source.content,'text/markdown;charset=utf-8')}><Download size={16}/> Stáhnout text zdroje</button></section></div>}
 </>;
}
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></React.StrictMode>);
