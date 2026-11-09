import type { Evidence, SourceDocument, Finding } from '@tendr/schemas';
export function verifyEvidence(evidence:Evidence,documents:SourceDocument[]):boolean {
 if(!evidence.quote.trim()||!evidence.locator.trim())return false;
 const matches=documents.filter(d=>d.id===evidence.documentId&&d.version===evidence.version);
 return matches.length===1&&matches[0]!.locator===evidence.locator&&matches[0]!.content.includes(evidence.quote);
}
export function qualityGate(findings:Finding[],documents:SourceDocument[],threshold=1) {
 if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw new RangeError('Invalid verification threshold');
 const supported=findings.map(f=>f.evidence.length>0&&f.evidence.every(e=>verifyEvidence(e,documents)));
 const passed=supported.filter(Boolean).length;
 const criticalUnsupported=findings.some((f,i)=>(f.severity==='critical'||f.severity==='high')&&!supported[i]);
 return {passed,total:findings.length,deliverable:findings.length>0&&passed/findings.length>=threshold&&!criticalUnsupported};
}
