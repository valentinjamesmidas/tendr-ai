import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Check, ClipboardCheck, Coins, Download, FileText, Layers3, X } from 'lucide-react';
import { analysisCreditPriceMinor, customerAccountSchema, plans, singleOfferPriceMinor, subscriptionReceiptSchema, type CustomerAccount, type NenAnalysis, type PurchaseSelection } from '@tendr/schemas';
import './customer-workflows.css';

const customerPrice = new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0});
const formatPrice = (minor:number) => customerPrice.format(minor/100);

function WorkspaceDialog({ open, onClose, title, children, wide=false }: {
 open:boolean; onClose:()=>void; title:string; children:ReactNode; wide?:boolean;
}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const heading=useId();
 useEffect(()=>{
  const element=dialog.current;
  if(open&&!element?.open)element?.showModal();
  if(!open&&element?.open)element.close();
 },[open]);
 return <dialog ref={dialog} className={`customer-dialog${wide?' customer-dialog-wide':''}`} aria-labelledby={heading} onClose={onClose}>
  <header className="customer-dialog-head">
   <h2 id={heading}>{title}</h2>
   <button className="customer-dialog-close" type="button" onClick={onClose} aria-label="Zavřít"><X size={22}/></button>
  </header>
  {children}
 </dialog>;
}

function makeBidDraft(report:NenAnalysis) {
 const referenceSources=new Map(report.bibliography.map(source=>[source.id,source]));
 const requirements=report.findings.map((finding,index)=>{
  const quotes=finding.evidence.map(evidence=>{
   const source=referenceSources.get(evidence.documentId);
   return `   - Podklad – ${source?.name??evidence.documentId}, ${evidence.locator}\n     > ${evidence.quote}`;
  });
  return [`${index+1}. **${finding.title}**`, `   - Požadavek – ${finding.requirement}`, `   - Další krok – ${finding.action}`, ...quotes].join('\n');
 });
 return [
  `# Pracovní nabídka – ${report.title}`,
  `Číslo zakázky NEN ${report.reference}${report.authority?`\nZadavatel – ${report.authority}`:''}`,
  '## Údaje dodavatele\n[Název firmy, IČO, sídlo a oprávněná osoba]\n[Kontaktní e-mail a telefon]',
  '## Nabízené plnění a cena\n[Popis plnění podle zadávací dokumentace]\n[Cena plnění v předepsané struktuře, měně a režimu DPH]',
  '## Doklady a podpis\n[Povinné formuláře, kvalifikační doklady a ostatní přílohy]\n[Místo, datum a podpis oprávněné osoby]',
  `## Podklady k dopracování\n${requirements.join('\n\n')||'Doplňte ověřené požadavky ze zadávací dokumentace.'}`,
  ...(report.gaps.length ? [`## K ověření před podáním\n${report.gaps.map(gap=>`- ${gap}`).join('\n')}`] : []),
 ].join('\n\n');
}

export function LiveOfferDialog({ report, open, onClose, exampleDraft, onOrder }: {
 report:NenAnalysis; open:boolean; onClose:()=>void; exampleDraft?:string; onOrder:()=>void;
}) {
 const [draft,setDraft]=useState(()=>exampleDraft??makeBidDraft(report));
 const [view,setView]=useState<'draft'|'checklist'>('draft');
 const [completed,setCompleted]=useState<string[]>([]);
 const items=[
  ...report.findings.map(finding=>({id:finding.id,title:finding.title,task:finding.action})),
  {id:'review-documents',title:'Prověřit úplnost podkladů',task:'Projít aktuální dokumentaci, vysvětlení a soubory k ruční kontrole.'},
  {id:'prepare-price',title:'Doplnit údaje a cenu dodavatele',task:'Použít požadované formuláře, vyplnit nabídkovou cenu a připravit podpis.'},
  {id:'submit',title:'Ověřit lhůtu a způsob podání',task:'Porovnat hotový balíček se zadávací dokumentací a podat jej v NEN.'},
 ];
 function downloadDraft() {
  const url=URL.createObjectURL(new Blob([draft],{type:'text/markdown;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=`nabidka-${report.reference.replaceAll('/','-')}.md`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <WorkspaceDialog open={open} onClose={onClose} title={exampleDraft?'Ukázková nabídka':'Pracovní nabídka'} wide>
  <div className="customer-dialog-body">
   <div className="customer-offer-title"><span className="customer-dialog-icon"><FileText size={23}/></span><div><h3>{report.title}</h3><a href={`https://nen.nipez.cz/verejne-zakazky/detail-zakazky/${report.reference.replaceAll('/','-')}`} target="_blank" rel="noreferrer">{report.reference} v NEN <ArrowUpRight size={14}/></a></div></div>
   {exampleDraft ? <p className="customer-sample-note">Pracovní ukázka na základě skutečné zakázky. Údaje dodavatele, cena a lhůty jsou k doplnění.</p> : <p className="customer-intro">Doplňte údaje firmy a cenu plnění. Před podáním ověřte požadavky a použijte formuláře zadavatele.</p>}
   <div className="customer-view-buttons" role="group" aria-label="Zobrazení nabídky">
    <button type="button" aria-pressed={view==='draft'} onClick={()=>setView('draft')}><FileText size={16}/> Návrh nabídky</button>
    <button type="button" aria-pressed={view==='checklist'} onClick={()=>setView('checklist')}><ClipboardCheck size={16}/> Kontrolní seznam <span>{completed.length}/{items.length}</span></button>
   </div>
   {view==='draft' ? <label className="customer-field">Upravit návrh nabídky<textarea rows={13} value={draft} onChange={event=>setDraft(event.target.value)}/></label> : <section className="customer-checklist" aria-label="Kontrolní seznam nabídky">
    <progress max={items.length} value={completed.length} aria-label="Splněné kroky"/>
    {items.map(item=><label key={item.id}><input type="checkbox" checked={completed.includes(item.id)} onChange={event=>{
     const checked=event.target.checked;
     setCompleted(previous=>checked?[...previous,item.id]:previous.filter(id=>id!==item.id));
    }}/><span><strong>{item.title}</strong>{item.task}</span></label>)}
   </section>}
  </div>
  <footer className="customer-dialog-actions">
   <button type="button" className={exampleDraft?'primary':'secondary'} onClick={downloadDraft} disabled={!draft.trim()}><Download size={17}/> Stáhnout návrh</button>
   {!exampleDraft&&<button type="button" className="primary" onClick={onOrder}>Objednat přípravu <ArrowRight size={17}/></button>}
  </footer>
 </WorkspaceDialog>;
}

export function SubscriptionDialog({ selection, customer, onClose }: {selection:PurchaseSelection; customer:CustomerAccount|null; onClose:()=>void}) {
 const [requestId]=useState(()=>crypto.randomUUID());
 const [pending,setPending]=useState(false);
 const [receipt,setReceipt]=useState<string>();
 const [error,setError]=useState('');
 const plan=selection.plan==='credit'||selection.plan==='offer'?null:plans[selection.plan];
 const title=plan?.name??(selection.plan==='credit'?'1 kredit na analýzu':'Příprava nabídky');
 const cost=selection.plan==='credit'?formatPrice(analysisCreditPriceMinor)
  : selection.plan==='offer'?formatPrice(singleOfferPriceMinor)
  : selection.plan==='business'&&selection.billing==='annual'?`${formatPrice(plans.business.annualMinor)} ročně`
  : plan&&'monthlyMinor' in plan?`${formatPrice(plan.monthlyMinor)} měsíčně`:undefined;

 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if(pending||receipt)return;
  const data=new FormData(event.currentTarget);
  setPending(true);
  setError('');
  try {
   const response=await fetch('/api/subscription-requests',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId,selection,email:data.get('email'),company:data.get('company')}),
   });
   const result:unknown=await response.json();
   const success=subscriptionReceiptSchema.safeParse(result);
   if(response.ok&&success.success&&success.data.requestId===requestId){setReceipt(requestId);return;}
   if(result&&typeof result==='object'&&'message' in result&&typeof result.message==='string'){setError(result.message);return;}
   throw new Error('Invalid subscription receipt');
  } catch {
   setError('Poptávku se nepodařilo uložit. Zkuste ji za chvíli odeslat znovu.');
  } finally {
   setPending(false);
  }
 }

 return <WorkspaceDialog open onClose={onClose} title={receipt?'Poptávka uložena':'Poptávka'}>
  <div className="customer-dialog-body">
   {receipt ? <div className="customer-receipt" role="status"><span className="customer-dialog-icon"><Check size={24}/></span><p>Poptávku na <strong>{title}</strong> jsme přijali. Číslo poptávky si můžete uložit.</p><code>{receipt}</code></div> : <>
    <div className="customer-offer-title"><span className="customer-dialog-icon"><Layers3 size={22}/></span><div><h3>{title}</h3>{cost&&<p>{cost}</p>}{selection.plan==='offer'&&<p>{selection.reference}</p>}</div></div>
    <p className="customer-intro">Zanechte e-mail pro domluvu aktivace. Odesláním vznikne poptávka bez platby.</p>
    <form id="subscription-request-form" onSubmit={submit} className="customer-form">
     <label className="customer-field">Pracovní e-mail<input name="email" type="email" required maxLength={254} defaultValue={customer?.email} autoComplete="email" disabled={pending}/></label>
     <label className="customer-field">Firma <span>(nepovinné)</span><input name="company" maxLength={150} autoComplete="organization" disabled={pending}/></label>
     <p className="customer-privacy">E-mail použijeme k vyřízení poptávky.</p>
     {error&&<p className="error" role="alert">{error}</p>}
    </form>
   </>}
  </div>
  <footer className="customer-dialog-actions">
   <button type="button" className="secondary" onClick={onClose}>{receipt?'Hotovo':'Zpět na ceník'}</button>
   {!receipt&&<button type="submit" form="subscription-request-form" className="primary" disabled={pending}>{pending?'Ukládám poptávku…':'Odeslat poptávku'} <ArrowRight size={16}/></button>}
  </footer>
 </WorkspaceDialog>;
}

export function AccountDialog({ customer, onAccountChange, onClose, onBuyCredit }: {
 customer:CustomerAccount|null; onAccountChange:(customer:CustomerAccount|null)=>void; onClose:()=>void; onBuyCredit:()=>void;
}) {
 const [mode,setMode]=useState<'register'|'login'>('register');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const credited=(credits:number)=>credits===1?'1 kredit':credits>=2&&credits<=4?`${credits} kredity`:`${credits} kreditů`;

 async function accountAction(body:{action:'register'|'login';email:FormDataEntryValue|null;password:FormDataEntryValue|null}|{action:'logout'}) {
  if(pending)return;
  setPending(true);
  setError('');
  try {
   const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result:unknown=await response.json();
   if(response.ok){onAccountChange(customerAccountSchema.parse(result).customer);return;}
   if(result&&typeof result==='object'&&'message' in result&&typeof result.message==='string'){setError(result.message);return;}
   throw new Error('Invalid account response');
  } catch {
   setError('Účet teď nejde načíst. Zkuste to za chvíli znovu.');
  } finally {
   setPending(false);
  }
 }

 return <WorkspaceDialog open onClose={onClose} title={customer?'Můj účet':mode==='register'?'Vytvořit účet':'Přihlásit se'}>
  <div className="customer-dialog-body">
   {customer ? <>
    <div className="customer-credit-total"><span className="customer-dialog-icon"><Coins size={23}/></span><div><strong>{credited(customer.credits)}</strong><p>{customer.email}</p></div></div>
    <p className="customer-intro">Jedna dokončená analýza stojí jeden kredit.</p>
   </> : <>
    <p className="customer-intro">Po registraci získáte 1 kredit na první analýzu zdarma.</p>
    <div className="customer-view-buttons" role="group" aria-label="Přihlášení a registrace">
     <button type="button" disabled={pending} aria-pressed={mode==='register'} onClick={()=>{setMode('register');setError('');}}>Registrace</button>
     <button type="button" disabled={pending} aria-pressed={mode==='login'} onClick={()=>{setMode('login');setError('');}}>Přihlášení</button>
    </div>
    <form id="customer-account-form" className="customer-form" onSubmit={event=>{
     event.preventDefault();
     const data=new FormData(event.currentTarget);
     void accountAction({action:mode,email:data.get('email'),password:data.get('password')});
    }}>
     <label className="customer-field">E-mail<input name="email" type="email" required maxLength={254} autoComplete="username" disabled={pending}/></label>
     <label className="customer-field">Heslo<input name="password" type="password" required minLength={12} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} disabled={pending}/></label>
     {mode==='register'&&<p className="customer-privacy">Heslo musí mít alespoň 12 znaků.</p>}
    </form>
   </>}
   {error&&<p className="error" role="alert">{error}</p>}
  </div>
  <footer className="customer-dialog-actions">
   {customer ? <><button type="button" className="secondary" disabled={pending} onClick={()=>void accountAction({action:'logout'})}>Odhlásit se</button><button type="button" className="primary" onClick={onBuyCredit}>Přidat kredit <ArrowRight size={16}/></button></> : <>
    <button type="button" className="secondary" onClick={onClose}>Zpět</button>
    <button type="submit" form="customer-account-form" className="primary" disabled={pending}>{pending?'Zpracovávám…':mode==='register'?'Vytvořit účet':'Přihlásit se'} <ArrowRight size={16}/></button>
   </>}
  </footer>
 </WorkspaceDialog>;
}
