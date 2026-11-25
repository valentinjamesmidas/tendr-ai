import type { AuditAIProvider, Tender, Finding, SourceDocument } from '@tendr/schemas';
function evidence(d:SourceDocument,quote:string){return {documentId:d.id,version:d.version,locator:d.locator,quote};}
// Deterministic fixture-only assessment. No model call, no claims of real AI performance.
export class MockAuditAIProvider implements AuditAIProvider {
 async analyze(tender:Tender):Promise<Finding[]> {
  const contract=tender.documents.find(d=>d.id.endsWith('-contract'));
  const spec=tender.documents.find(d=>d.id.endsWith('-spec'));
  if(!contract||!spec)return [];
  const payment=contract.content.match(/Splatnost faktur činí \d+ dnů\./)?.[0];
  const reference=spec.content.match(/(?:Zadavatel požaduje dvě reference|Dodavatel doloží tři reference)[^.]+\./)?.[0];
  const findings:Finding[]=[];
  if(payment)findings.push({id:'payment-terms',title:'Splatnost faktur mění potřebu financování',category:'financial',severity:'medium',explanation:`${payment} Zohledněte období, kdy jsou práce nebo dodávka už zaplacené vašim dodavatelům, ale faktura zadavateli ještě není splatná.`,action:'Zapište platební milníky a splatnost do plánu cash flow. Ověřte, od kdy splatnost běží.',kind:'assessment',evidence:[evidence(contract,payment)]});
  if(reference)findings.push({id:'qualification-gap',title:'Chybí doklady o referencích firmy',category:'qualification',severity:'high',explanation:`${reference} Splnění pro konkrétní firmu je potřeba doložit.`,action:'Přiřaďte ke každé referenci objednatele, popis plnění, hodnotu a doklad. Vyřaďte reference pod požadovaným limitem.',kind:'assessment',evidence:[evidence(spec,reference)]});
  const attachments=spec.content.match(/Nabídka musí obsahovat [^.]+\./)?.[0];
  if(attachments)findings.push({id:'required-attachments',title:'Povinné přílohy musí být součástí nabídky',category:'technical',severity:'critical',explanation:`${attachments} Bez těchto podkladů může být nabídka neúplná.`,action:'Připravte každý požadovaný soubor a při finální kontrole jej porovnejte s požadavkem zadavatele.',kind:'assessment',evidence:[evidence(spec,attachments)]});
  const retention=contract.content.match(/Zádržné činí [^.]+\./)?.[0];
  if(retention)findings.push({id:'retention-terms',title:'Část ceny bude zadržena',category:'financial',severity:'high',explanation:`${retention} Zadržené peníze mohou chybět v cash flow po předání plnění.`,action:'Promítněte zádržné do plánu inkasa. Ověřte, kdy a za jakých podmínek se uvolní.',kind:'assessment',evidence:[evidence(contract,retention)]});
  const warranty=contract.content.match(/Záruka trvá [^.]+\./)?.[0];
  if(warranty)findings.push({id:'warranty',title:'Zahrňte do nabídky náklady na záruku',category:'legal',severity:'high',explanation:`${warranty} Délka záruky má dopad na závazky po dodání a potřebnou servisní kapacitu.`,action:'Před naceněním ověřte rozsah záručních povinností, reakční doby a dostupnost servisního týmu.',kind:'assessment',evidence:[evidence(contract,warranty)]});
  const availability=spec.content.match(/Požadována je dostupnost služby [^.]+\./)?.[0];
  if(availability)findings.push({id:'service-availability',title:'SLA musí pokrýt předepsanou dostupnost',category:'technical',severity:'high',explanation:`${availability} Plán podpory a obnovy musí tomuto požadavku odpovídat.`,action:'Do SLA uveďte úroveň dostupnosti a ověřte metodiku měření, výluky a reakci při výpadku.',kind:'assessment',evidence:[evidence(spec,availability)]});
  const a=contract.content.match(/Dokončení díla do [^.]+\. [^.]+\. \d{4}\./)?.[0];
  const b=spec.content.match(/Dokončení díla do [^.]+\. [^.]+\. \d{4}\./)?.[0];
  if(a&&b&&a!==b)findings.push({id:'deadline-conflict',title:'Rozpor v termínu dokončení',category:'conflict',severity:'high',explanation:'Smlouva a technická specifikace uvádějí různé termíny. Z těchto podkladů nelze určit závazné pořadí dokumentů.',action:'Vyžádejte vysvětlení a sjednocení termínu zadavatelem.',kind:'source_fact',evidence:[evidence(contract,a),evidence(spec,b)]});
  return findings;
 }
}
