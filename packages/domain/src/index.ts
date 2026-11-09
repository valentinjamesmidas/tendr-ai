import { tenderSchema, findingSchema, type Tender, type AuditReport, type Finding } from '@tendr/schemas';
import { calculateExposure } from '@tendr/rules';
import { documentSetHash } from '@tendr/sources';
import { MockAuditAIProvider } from '@tendr/ai';
import { qualityGate } from '@tendr/verification';
export { fixtures, normalizeReference, MockSourceProvider, documentSetHash } from '@tendr/sources';
export { formatMoney, calculateExposure } from '@tendr/rules';
export { verifyEvidence, qualityGate } from '@tendr/verification';
export { MockAuditAIProvider } from '@tendr/ai';
export async function runAudit(input:Tender):Promise<AuditReport> {
 const tender=tenderSchema.parse(input);
 const calculations=calculateExposure({valueMinor:tender.valueMinor,penaltyBps:tender.penaltyBps,retentionBps:tender.retentionBps,days:30});
 const findings:Finding[]=await new MockAuditAIProvider().analyze(tender);
 const contract=tender.documents.find(d=>d.id.endsWith('-contract'));
 if(contract){
  const quote=contract.content.match(/Smluvní pokuta za prodlení činí [^.]+\./)?.[0];
  if(quote)findings.push({id:'daily-penalty',title:'Denní smluvní pokuta',category:'financial',severity:'high',explanation:'Deterministický výpočet z uložené ceny a sazby. Scénář 30 dnů je uživatelský předpoklad, nikoli předpověď budoucího nákladu. Výše plnění a aplikace ustanovení vyžaduje posouzení.',action:'Zvažte financování případného prodlení a ověřte smluvní limity.',kind:'calculation',evidence:[{documentId:contract.id,version:contract.version,locator:contract.locator,quote}]});
 }
 const parsed=findings.map(f=>findingSchema.parse(f));
 const verification=qualityGate(parsed,tender.documents);
 // Fixture numeric parameters must agree with exact contract inputs before delivery.
 const penalty=contract?.content.match(/Smluvní pokuta za prodlení činí (\d+),(\d{2}) %/);
 const retention=contract?.content.match(/Zádržné činí (\d+) %/);
 const price=contract?.content.match(/Cena (?:díla|dodávky) činí ([\d ]+) Kč/);
 const numericVerified=!!penalty&&!!retention&&!!price&&Number(penalty[1])*100+Number(penalty[2])===tender.penaltyBps&&Number(retention[1])*100===tender.retentionBps&&Number(price[1]!.replace(/ /g,''))*100===tender.valueMinor;
 verification.deliverable=verification.deliverable&&numericVerified;
 return {id:crypto.randomUUID(),reference:tender.reference,createdAt:new Date().toISOString(),documentSetHash:await documentSetHash(tender.documents),ruleVersion:'1.0.0',provider:'mock',model:'deterministic-fixture',findings:parsed,verification,calculations,verdict:verification.deliverable?'CONDITIONAL GO':'NO-GO'};
}
