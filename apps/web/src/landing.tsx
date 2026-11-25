import {
  ArrowDown, ArrowRight, ArrowUpRight, Building2, Check, ClipboardCheck,
  Download, FileText, FolderArchive, FolderOpen, Laptop, ShieldCheck,
} from 'lucide-react';
import { fixtures, formatMoney } from '@tendr/domain';
import civicBuilding from './assets/civic-building.webp';
import { NenIntake } from './nen-analysis';
import './landing.css';

interface LandingProps {
  price: string;
  invalidReference: boolean;
  onOpenTender: (reference: string) => void;
}

const included = ['Matice požadavků s citacemi', 'Formuláře a kontrolní seznam', 'Kontrola specialistkou'];

export function Landing({ price, invalidReference, onOpenTender }: LandingProps) {
  const example = fixtures[0]!;

  return <main className="landing">
    <section className="landing-hero landing-container">
      <div className="landing-intro">
        <p className="landing-kicker">Pro malé firmy a živnostníky</p>
        <h1>Nabídka na klíč.<br className="hero-break"/> Stačí číslo NEN.</h1>
        <p>Zadejte číslo veřejné zakázky. Z dostupných podkladů získáte přehled požadavků, rizik a kroků před podáním.</p>
        <div className="hero-actions">
          <a className="primary" href="#analyza">Zadat číslo NEN <ArrowRight size={18}/></a>
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

    <section className="nen-section landing-container" id="analyza">
      <h2>Analýza podle čísla NEN</h2>
      <p>Zadávejte jen číslo zakázky. Výsledek ukáže, které veřejné přílohy byly dostupné a které bude ještě potřeba ověřit.</p>
      <NenIntake/>
    </section>

    <section className="workflow" id="postup">
      <div className="landing-container">
        <h2>5 kroků od čísla k nabídce</h2>
        <ol className="workflow-steps">
          <li>
            <FolderOpen size={23}/>
            <h3>Zadejte číslo zakázky</h3>
            <p>Číslo NEN propojí analýzu s konkrétní zakázkou. Podklady nemusíte nahrávat ručně.</p>
          </li>
          <li>
            <Download size={23}/>
            <h3>Dohledání podkladů</h3>
            <p>Analýza pracuje s dostupnou zadávací dokumentací, smlouvou, přílohami i vysvětleními zadavatele.</p>
          </li>
          <li>
            <FolderArchive size={23}/>
            <h3>Rozbalení a čtení souborů</h3>
            <p>ZIP se rozbalí. U dokumentů a tabulek uvidíte, co šlo přečíst a co vyžaduje ruční kontrolu.</p>
          </li>
          <li>
            <ClipboardCheck size={23}/>
            <h3>Kritické požadavky jako první</h3>
            <p>U lhůt, kvalifikace, povinných formulářů a smluvních rizik dostanete citaci, dopad a konkrétní další krok.</p>
          </li>
          <li>
            <FileText size={23}/>
            <h3>Příprava a podání nabídky</h3>
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
        <summary>Co když některý soubor chybí nebo je nečitelný?</summary>
        <p>Výsledek označí nezpracované soubory a úseky. Neúplné podklady i rozporné požadavky najdete mezi body k ověření před podáním.</p>
      </details>
    </section>
  </main>;
}
