import {
  ArrowDown, ArrowRight, ArrowUpRight, Building2, ClipboardCheck, FileSearch,
  FileText, Flag, Laptop, ListChecks, ShieldCheck,
} from 'lucide-react';
import { fixtures, formatMoney } from '@tendr/domain';
import type { NenAnalysis, PlanSelection } from '@tendr/schemas';
import civicBuilding from './assets/civic-building.webp';
import { NenIntake } from './nen-analysis';
import { PricingSection } from './pricing-section';
import './landing.css';

interface LandingProps {
  price: string;
  invalidReference: boolean;
  onOpenTender: (reference: string) => void;
  onCreateOffer: (report: NenAnalysis) => void;
  onSelectPlan: (selection: PlanSelection) => void;
  onOpenExample: () => void;
  onOpenAccount: () => void;
  onBuyCredit: () => void;
  onAnalysisFinished: () => void;
}

const benefits = [
  {
    icon: FileSearch,
    title: 'Podklady dohledáme podle čísla NEN',
    description: 'Z dostupné veřejné dokumentace načteme přílohy, smlouvy i vysvětlení zadavatele. ZIPy rozbalíme za vás.',
  },
  {
    icon: Flag,
    title: 'Zjistíte, co může nabídku vyřadit',
    description: 'Lhůty, povinné přílohy, kvalifikaci a smluvní rizika projdete podle priority. U každého bodu uvidíte, co dál.',
  },
  {
    icon: ClipboardCheck,
    title: 'Každé zjištění si ověříte ve zdroji',
    description: 'Otevřete citovanou pasáž, najdete příslušný dokument a uvidíte, které podklady bude potřeba dočíst ručně.',
  },
  {
    icon: ListChecks,
    title: 'Z analýzy přejdete rovnou k nabídce',
    description: 'Zjištění si přenesete do pracovního návrhu. Doplníte údaje firmy, nabídkovou cenu a potřebné doklady.',
  },
];

export function Landing({
  price, invalidReference, onOpenTender, onCreateOffer, onSelectPlan,
  onOpenExample, onOpenAccount, onBuyCredit, onAnalysisFinished,
}: LandingProps) {
  return <main className="landing">
    <section className="landing-hero landing-container">
      <div className="landing-intro">
        <p className="landing-kicker">Pro dodavatele veřejných zakázek</p>
        <h1>Nabídka na klíč.<br className="hero-break"/> Stačí číslo NEN.</h1>
        <p>Zadejte číslo veřejné zakázky. Z dostupných podkladů získáte přehled požadavků, rizik a kroků před podáním.</p>
        <div className="hero-actions">
          <a className="primary" href="#analyza">Vytvořit nabídku <ArrowRight size={18}/></a>
          <a className="quiet-link" href="#postup">Jak to funguje <ArrowDown size={15}/></a>
        </div>
        <p className="hero-price"><strong>{price} za nabídku</strong><span>Bez provize z výhry</span></p>
      </div>
      <figure className="hero-visual">
        <img src={civicBuilding} width="1536" height="1024" alt="" fetchPriority="high"/>
        <button type="button" className="hero-package" aria-label="Otevřít ukázkovou nabídku ze skutečné zakázky" onClick={onOpenExample}>
          <span className="hero-package-head">
            <span className="hero-package-icon"><FileText size={21}/></span>
            <span><strong>Ukázka nabídky</strong><span>Skutečná zakázka z NEN</span></span>
            <ArrowUpRight size={20} className="package-arrow"/>
          </span>
          <span className="hero-package-list">
            <span><ClipboardCheck size={17}/> Požadavky a jejich zdroje</span>
            <span><ShieldCheck size={17}/> Rizika podle priority</span>
            <span><FileText size={17}/> Podklady pro pracovní návrh</span>
          </span>
        </button>
      </figure>
    </section>

    <section className="landing-benefits" id="postup" aria-labelledby="benefits-title">
      <div className="landing-container benefits-layout">
        <div className="benefits-heading">
          <h2 id="benefits-title">Co vám tendr.ai usnadní</h2>
          <a className="benefits-link" href="#analyza">Zanalyzovat zakázku <ArrowDown size={17} aria-hidden="true"/></a>
        </div>
        <ol className="benefits-list">
          {benefits.map(({ icon: Icon, title, description }, index) => <li key={title}>
            <span className="benefits-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className="benefits-icon"><Icon size={22} aria-hidden="true"/></span>
            <div><h3>{title}</h3><p>{description}</p></div>
          </li>)}
        </ol>
      </div>
    </section>

    <section className="nen-section landing-container" id="analyza">
      <h2>Analýza podle čísla NEN</h2>
      <p>Zadávejte jen číslo zakázky. Výsledek ukáže, které veřejné přílohy byly dostupné a které bude ještě potřeba ověřit.</p>
      <NenIntake onCreateOffer={onCreateOffer} onOpenAccount={onOpenAccount} onOpenPricing={onBuyCredit} onAnalysisFinished={onAnalysisFinished}/>
    </section>

    <section className="landing-container real-example" id="ukazka-nabidky" aria-labelledby="real-example-title">
      <div className="real-example-info">
        <span className="real-example-icon"><FileSearch size={24} aria-hidden="true"/></span>
        <div>
          <p className="real-example-kicker">Ukázka na skutečné zakázce</p>
          <h2 id="real-example-title">Externí evaluace pro projekt Obec pro všechny</h2>
          <p className="real-example-meta"><span className="mono">N006/26/V00015697</span><span>Ministerstvo pro místní rozvoj</span></p>
        </div>
      </div>
      <button className="primary" type="button" onClick={onOpenExample}>Otevřít ukázkovou nabídku <ArrowRight size={18} aria-hidden="true"/></button>
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

    <PricingSection singlePrice={price} onSelectPlan={onSelectPlan} onOpenAccount={onOpenAccount} onBuyCredit={onBuyCredit}/>

    <section className="landing-container landing-faq" id="faq">
      <details>
        <summary>Co když některý soubor chybí nebo je nečitelný?</summary>
        <p>Výsledek označí nezpracované soubory a úseky. Neúplné podklady i rozporné požadavky najdete mezi body k ověření před podáním.</p>
      </details>
      <details>
        <summary>Podá tendr.ai nabídku za mě?</summary>
        <p>V aplikaci připravíte pracovní návrh. Cenu, oprávnění k podpisu a doklady ověříte před odesláním ve veřejném systému.</p>
      </details>
      <details>
        <summary>Jak fungují kredity?</summary>
        <p>Jeden kredit pokryje jednu analýzu zakázky. První kredit získáte registrací. Další můžete dokoupit samostatně nebo je získat v tarifu.</p>
      </details>
    </section>
  </main>;
}
