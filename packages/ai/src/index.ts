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
  if(payment)findings.push({id:'payment-terms',title:'Delší splatnost faktur',category:'financial',severity:'medium',explanation:'Ukázkové posouzení: splatnost může zvyšovat potřebu provozního financování. Dopad závisí na skutečném platebním plánu.',action:'Prověřte splatnost a model peněžních toků s finančním týmem.',kind:'assessment',evidence:[evidence(contract,payment)]});
  if(reference)findings.push({id:'qualification-gap',title:'Chybí doklady o referencích firmy',category:'qualification',severity:'high',explanation:'Podmínka je uvedena v dokumentaci. Profil a reference dodavatele nebyly doloženy; splnění nelze potvrdit.',action:'Doplňte reference a ověřte jejich soulad s přesnou podmínkou zadavatele.',kind:'assessment',evidence:[evidence(spec,reference)]});
  const a=contract.content.match(/Dokončení díla do [^.]+\. [^.]+\. \d{4}\./)?.[0];
  const b=spec.content.match(/Dokončení díla do [^.]+\. [^.]+\. \d{4}\./)?.[0];
  if(a&&b&&a!==b)findings.push({id:'deadline-conflict',title:'Rozpor v termínu dokončení',category:'conflict',severity:'high',explanation:'Smlouva a technická specifikace uvádějí různé termíny. Z těchto podkladů nelze určit závazné pořadí dokumentů.',action:'Vyžádejte vysvětlení a sjednocení termínu zadavatelem.',kind:'source_fact',evidence:[evidence(contract,a),evidence(spec,b)]});
  return findings;
 }
}
