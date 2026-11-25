import {
  ArrowDown, ArrowRight, ArrowUpRight, Building2, Check, ClipboardCheck,
  FileText, FolderOpen, Laptop, Search, ShieldCheck,
} from 'lucide-react';
import { fixtures, formatMoney } from '@tendr/domain';
import civicBuilding from './assets/civic-building.webp';
import './landing.css';

interface LandingProps {
  price: string;
  reference: string;
  invalidReference: boolean;
  error: string;
  onReferenceChange: (reference: string) => void;
  onOpenTender: (reference: string) => void;
}

const included = ['Matice požadavků s citacemi', 'Formuláře a kontrolní seznam', 'Kontrola specialistkou'];

export function Landing({ price, reference, invalidReference, error, onReferenceChange, onOpenTender }: LandingProps) {
  const example = fixtures[0]!;

  return <main className="landing">
    <section className="landing-hero landing-container">
      <div className="landing-intro">
        <p className="landing-kicker">Pro malé firmy a živnostníky</p>
        <h1>Nabídka na klíč<br className="hero-break"/> do veřejné zakázky</h1>
        <p>Ze zadávací dokumentace připravíme formuláře, matici požadavků a kontrolní seznam. Před předáním balíček zkontroluje specialistka.</p>
        <div className="hero-actions">
          <a className="primary" href="#ukazky">Vyzkoušet demo <ArrowRight size={18}/></a>
          <a className="quiet-link" href="#postup">Jak to funguje <ArrowDown size={15}/></a>
        </div>
        <p className="hero-price"><strong>{price} za nabídku</strong><span>Bez provize z výhry</span></p>
      </div>
      <figure className="hero-visual">
        <img src={civicBuilding} width="1536" height="1024" alt="" fetchPriority="high"/>
        <button type="button" className="hero-package" aria-label="Otevřít ukázkovou stavební nabídku" onClick={() => onOpenTender(example.reference)}>
          <span className="hero-package-head">
            <span className="hero-package-icon"><FileText size={21}/></span>
            <span><strong>Balíček nabídky</strong><span>Ukázková stavební zakázka</span></span>
            <ArrowUpRight size={20} className="package-arrow"/>
          </span>
          <span className="hero-package-list">
            <span><ClipboardCheck size={17}/> Matice požadavků</span>
            <span><FileText size={17}/> Formuláře nabídky</span>
            <span><ShieldCheck size={17}/> Kontrola specialistkou</span>
          </span>
        </button>
      </figure>
    </section>

    <section className="workflow" id="postup">
      <div className="landing-container">
        <h2>Od zadání k podání</h2>
        <ol className="workflow-steps">
          <li>
            <FolderOpen size={23}/>
            <h3>Pošlete odkaz na zakázku</h3>
            <p>Zadání z NEN nebo E-ZAK a doplňující podklady řešíme písemně.</p>
          </li>
          <li>
            <ClipboardCheck size={23}/>
            <h3>Připravíme balíček</h3>
            <p>Sestavíme požadavky s citacemi a připravíme formuláře. Výstup projde kontrolou specialistky.</p>
          </li>
          <li>
            <FileText size={23}/>
            <h3>Doplníte cenu a podáte nabídku</h3>
            <p>Do balíčku doplníte cenu a své doklady. Nabídku podepíšete a podáte sami.</p>
          </li>
        </ol>
      </div>
    </section>

    <section className="demo-section landing-container" id="ukazky">
      <div className="demo-heading">
        <div>
          <h2>Vyzkoušejte přípravu nabídky</h2>
          <p>Demo používá ukázkové zakázky. Platba i kontrola specialistkou jsou simulované.</p>
        </div>
        <form className="reference-form" onSubmit={e => { e.preventDefault(); onOpenTender(reference); }}>
          <label htmlFor="reference">Číslo veřejné zakázky</label>
          <div className="reference-field">
            <div className="reference-input"><Search size={18}/><input id="reference" value={reference} onChange={e => onReferenceChange(e.target.value)} placeholder={example.reference} autoComplete="off"/></div>
            <button className="primary" type="submit">Otevřít zakázku <ArrowRight size={16}/></button>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
        </form>
      </div>
      {invalidReference && <p role="alert" className="error">Tato zakázka není v demo prostředí dostupná. Vyberte jednu z ukázek níže.</p>}
      <div className="demo-tenders">
        {fixtures.map(tender => {
          const construction = tender.sector === 'construction';
          const Icon = construction ? Building2 : Laptop;
          return <button key={tender.reference} type="button" className="demo-tender" onClick={() => onOpenTender(tender.reference)} data-testid={`fixture-${tender.sector}`}>
            <span className="demo-tender-top">
              <span className={`demo-tender-icon ${tender.sector}`}><Icon size={23}/></span>
              <span>{construction ? 'Stavební práce' : 'IT a technologie'}</span>
              <ArrowUpRight size={21} className="card-arrow"/>
            </span>
            <span className="mono demo-reference">{tender.reference}</span>
            <strong>{tender.title}</strong>
            <span className="demo-tender-meta"><span>{formatMoney(tender.valueMinor)}</span><span>{tender.documents.length} dokumenty</span></span>
          </button>;
        })}
      </div>
    </section>

    <section className="landing-container pricing-section" id="pricing">
      <div>
        <h2>Pevná cena za jednu nabídku</h2>
        <ul className="pricing-features">{included.map(feature => <li key={feature}><Check size={19}/>{feature}</li>)}</ul>
      </div>
      <div className="pricing-card">
        <span>Příprava jedné nabídky</span>
        <strong>{price}</strong>
        <p>Bez provize z výsledku zakázky.</p>
        <a className="primary" href="#ukazky">Vyzkoušet demo zdarma <ArrowRight size={18}/></a>
      </div>
    </section>

    <section className="landing-container landing-faq" id="faq">
      <details>
        <summary>Můžu v demu zadat vlastní zakázku?</summary>
        <p>V demu můžete projít dvě připravené ukázky. Hotový balíček si stáhnete jako Markdown nebo vytisknete do PDF.</p>
      </details>
    </section>
  </main>;
}
