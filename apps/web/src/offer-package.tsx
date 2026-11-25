import { ArrowRight, ArrowUpRight, Download, FileText, ListChecks, ShieldCheck } from 'lucide-react';
import type { SourceDocument } from '@tendr/schemas';
import type { OfferRequirement } from './offer-draft';

interface OfferPackageProps {
  requirements: OfferRequirement[];
  documents: SourceDocument[];
  reviewed: boolean;
  onReview: () => void;
  onOpenSource: (document: SourceDocument) => void;
  offer: string;
  onEdit: (text: string) => void;
  onDownload: () => void;
}

export function OfferPackage({ requirements, documents, reviewed, onReview, onOpenSource, offer, onEdit, onDownload }: OfferPackageProps) {
  return <div className="offer-package">
    <section className="panel">
      <div className="panel-title"><ListChecks size={19}/><h2>Matice požadavků</h2></div>
      <p className="panel-copy">Body k doplnění a vyjasnění podle citovaných pasáží zadávací dokumentace.</p>
      <div className="table-scroll">
        <table className="requirements-table">
          <thead><tr><th scope="col">Požadavek</th><th scope="col">Podklad</th><th scope="col">Další krok</th></tr></thead>
          <tbody>{requirements.map(requirement =>
            <tr key={requirement.id}>
              <th scope="row">{requirement.title}</th>
              <td>{requirement.evidence.map((evidence, index) => {
                const document = documents.find(item => item.id === evidence.documentId && item.version === evidence.version);
                return <div className="requirement-evidence" key={index}>
                  <q>{evidence.quote}</q>
                  {document && <button className="text-button" onClick={() => onOpenSource(document)}>
                    {document.name} · verze {evidence.version} · {evidence.locator} <ArrowUpRight size={13}/>
                  </button>}
                </div>;
              })}</td>
              <td>{requirement.action}</td>
            </tr>,
          )}</tbody>
        </table>
      </div>
    </section>
    <section className="panel">
      <div className="panel-title"><ShieldCheck size={19}/><h2>Kontrola specialistkou</h2></div>
      <p className="panel-copy" role="status">{reviewed
        ? 'Ukázková kontrola proběhla. Před podáním zůstávají k vyřízení body z matice požadavků a kontrolního seznamu.'
        : 'V ukázce je kontrola specialistkou simulovaná. Po tomto kroku se zobrazí balíček k předání.'}</p>
      {!reviewed && <button className="primary" onClick={onReview}>Simulovat kontrolu specialistkou <ArrowRight size={16}/></button>}
    </section>
    {reviewed && <section className="panel offer-panel">
      <div className="panel-title"><FileText size={19}/><h2>Balíček nabídky k předání</h2></div>
      <label className="panel-copy" htmlFor="offer-draft">Upravit návrh nabídky</label>
      <textarea id="offer-draft" className="draft offer-draft" value={offer} onChange={e => onEdit(e.target.value)} aria-describedby="offer-help"/>
      <p className="panel-copy" id="offer-help">Doplňte cenu plnění, údaje firmy a doklady. Před podáním ověřte předepsané formuláře a nabídku podepište.</p>
      <pre className="offer-print">{offer}</pre>
      <div className="button-row">
        <button className="primary" disabled={!offer.trim()} onClick={onDownload}><Download size={16}/> Stáhnout balíček nabídky</button>
      </div>
    </section>}
  </div>;
}
