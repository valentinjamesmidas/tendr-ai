import { verifyEvidence } from '@tendr/domain';
import type { AuditReport, Evidence, Tender } from '@tendr/schemas';

export interface OfferRequirement {
  id: string;
  kind: 'attachment' | 'finding';
  title: string;
  action: string;
  evidence: Evidence[];
}

export function getOfferRequirements(tender: Tender, report: AuditReport): OfferRequirement[] {
  const attachments: OfferRequirement[] = tender.documents.flatMap(document =>
    Array.from(document.content.matchAll(/Nabídka musí obsahovat [^.]+\./g), (match, index) => ({
      id: `${document.id}-attachments-${index}`,
      kind: 'attachment',
      title: 'Povinné přílohy',
      action: 'Doplnit a přiložit požadované dokumenty.',
      evidence: [{ documentId: document.id, version: document.version, locator: document.locator, quote: match[0] }],
    })),
  );
  const findings: OfferRequirement[] = report.findings
    .filter(finding => finding.category === 'qualification' || finding.category === 'conflict')
    .map(({ id, title, action, evidence }) => ({ id, kind: 'finding', title, action, evidence }));
  return [...attachments, ...findings].filter(requirement =>
    requirement.evidence.every(evidence => verifyEvidence(evidence, tender.documents)),
  );
}

export function createOfferDraft(tender: Tender, requirements: OfferRequirement[]): string {
  const references = tender.qualification.map(requirement =>
    `- ${requirement.requirement} – ${requirement.condition}\n  [Doplňte údaje a doklady k referencím.]`,
  ).join('\n');
  const attachments = requirements
    .filter(requirement => requirement.kind === 'attachment')
    .flatMap(requirement => requirement.evidence.map(evidence => {
      const source = tender.documents.find(document => document.id === evidence.documentId);
      return `- „${evidence.quote}“ (${source?.name ?? evidence.documentId}, verze ${evidence.version}, ${evidence.locator})`;
    })).join('\n');

  return `# Nabídka – ${tender.title}

Ukázkové vzory ze syntetických podkladů. Použijte formuláře zadavatele, pokud je předepsal.

## Krycí list

Číslo zakázky – ${tender.reference}
Zadavatel – ${tender.authority}
Dodavatel – [Název, IČO, sídlo a kontaktní údaje]

- Cena bez DPH – [Doplňte Kč]
- DPH – [Doplňte Kč]
- Cena včetně DPH – [Doplňte Kč]
- Podpis – [Místo, datum, jméno a funkce oprávněné osoby]

## Předmět a způsob plnění

Předkládáme nabídku na zakázku „${tender.title}“.
[Popište nabízené plnění, postup a ověřený harmonogram.]

## Čestná prohlášení

### Pracovní vzor

Já, [jméno a funkce], jednající za [dodavatele], prohlašuji, že [doplňte ověřenou skutečnost a znění podle zadávací dokumentace].

[Místo, datum a podpis oprávněné osoby]

## Seznam referencí

${references || '[Doplňte kvalifikační požadavky a doklady.]'}

[Pro každou referenci uveďte objednatele, popis plnění, hodnotu bez DPH, období, kontaktní osobu a doklad.]

## Podklady pro jednotné evropské osvědčení (JEO)

Pokud se JEO na tuto zakázku použije, přeneste ověřené údaje do příslušného formuláře.

- Zadávací řízení – ${tender.reference}
- Hospodářský subjekt – [Identifikační údaje a oprávněná osoba]
- Důvody vyloučení – [Ověřené odpovědi a případné doklady]
- Kritéria pro výběr – [Podmínky zadavatele a údaje k jejich doložení]

## Přílohy

${attachments ? `${attachments}\n` : ''}[Přiložte požadované dokumenty a doplňte jejich seznam.]
`;
}
