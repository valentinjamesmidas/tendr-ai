import { describe,it,expect } from 'vitest';
import { fixtures, normalizeReference, calculateExposure, verifyEvidence, qualityGate, runAudit, documentSetHash, MockSourceProvider } from '../../packages/domain/src/index';
import type { Finding } from '../../packages/schemas/src/index';
describe('Reference trust boundary',()=>{
 it('normalizes supported input',()=>{
  expect(normalizeReference(' n006/26/v00018665 ')).toBe('N006/26/V00018665');
  expect(normalizeReference('https://nen.nipez.cz/verejne-zakazky/detail-zakazky/N006-26-V00018665')).toBe('N006/26/V00018665');
 });
 it.each(['https://nen.nipez.cz.evil.test/verejne-zakazky/detail-zakazky/N006-26-V00018665','http://nen.nipez.cz/verejne-zakazky/detail-zakazky/N006-26-V00018665','https://evil.test@nen.nipez.cz/verejne-zakazky/detail-zakazky/N006-26-V00018665','N006/26/V001','https://127.0.0.1/N006-26-V00018665','https://nen.nipez.cz/verejne-zakazky/detail-zakazky/N006-26-V00018665?url=https://evil.test'])('rejects unsupported URL %s',input=>expect(()=>normalizeReference(input)).toThrow());
 it('does not invent unknown tender metadata',async()=>{await expect(new MockSourceProvider().fetchMetadata('N006/26/V99999999')).rejects.toThrow();});
});
describe('Deterministic money',()=>{
 it('uses exact minor units',()=>{expect(calculateExposure({valueMinor:4850000000,penaltyBps:5,retentionBps:500,days:30})).toEqual({dailyPenaltyMinor:2425000,scenarioDays:30,scenarioPenaltyMinor:72750000,retentionMinor:242500000});});
 it('rounds half up once per day',()=>{expect(calculateExposure({valueMinor:1,penaltyBps:5000,retentionBps:5000,days:3})).toEqual({dailyPenaltyMinor:1,scenarioDays:3,scenarioPenaltyMinor:3,retentionMinor:1});});
 it.each([-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects unsafe money %s',valueMinor=>expect(()=>calculateExposure({valueMinor,penaltyBps:1,retentionBps:1,days:1})).toThrow());
 it('rejects overflow',()=>{expect(()=>calculateExposure({valueMinor:Number.MAX_SAFE_INTEGER,penaltyBps:10000,retentionBps:0,days:2})).toThrow();});
 it('rejects invalid rates and durations',()=>{expect(()=>calculateExposure({valueMinor:1,penaltyBps:10001,retentionBps:0,days:1})).toThrow();expect(()=>calculateExposure({valueMinor:1,penaltyBps:1,retentionBps:0,days:36501})).toThrow();});
});
describe('Evidence and audit',()=>{
 it('requires exact version, locator and nonempty source quote',()=>{
  const d=fixtures[0]!.documents[0]!;const e={documentId:d.id,version:d.version,locator:d.locator,quote:'Zádržné činí 5 % z ceny díla.'};
  expect(verifyEvidence(e,[d])).toBe(true);
  for(const bad of [{...e,version:'2'},{...e,locator:'strana 98'},{...e,quote:''},{...e,quote:'Není požadováno žádné zádržné.'}])expect(verifyEvidence(bad,[d])).toBe(false);
 });
 it('blocks unsupported high findings despite aggregate threshold',()=>{
  const d=fixtures[0]!.documents[0]!;
  const f:Finding={id:'x',title:'x',category:'legal',severity:'high',kind:'assessment',explanation:'x',action:'x',evidence:[{documentId:d.id,version:d.version,locator:d.locator,quote:'invented'}]};
  expect(qualityGate([f],[d],0).deliverable).toBe(false);
  expect(qualityGate([],[d]).deliverable).toBe(false);
 });
 it.each(fixtures)('grounds every synthetic fixture $sector',async(tender)=>{
  const report=await runAudit(tender);
  expect(report.verification.deliverable).toBe(true);expect(report.findings.length).toBeGreaterThanOrEqual(3);
  for(const f of report.findings)for(const e of f.evidence)expect(verifyEvidence(e,tender.documents)).toBe(true);
  if(tender.sector==='construction')expect(report.findings.some(f=>f.id==='deadline-conflict')).toBe(true);
 });
 it('blocks delivery if numeric parameters contradict source',async()=>{
  const t=structuredClone(fixtures[0]!);t.penaltyBps=50;expect((await runAudit(t)).verification.deliverable).toBe(false);
 });
 it('hash is order independent and changes with document contents',async()=>{
  const docs=fixtures[0]!.documents;
  expect(await documentSetHash(docs)).toBe(await documentSetHash([...docs].reverse()));
  const changed=structuredClone(docs);changed[0]!.content+=' Change';expect(await documentSetHash(docs)).not.toBe(await documentSetHash(changed));
 });
 it('rejects duplicate document IDs',async()=>{const d=fixtures[0]!.documents[0]!;await expect(documentSetHash([d,d])).rejects.toThrow();});
});
