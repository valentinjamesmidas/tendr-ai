import { useState } from 'react';
import { ArrowRight, Building2, Check, FilePenLine, Layers3, PanelsTopLeft } from 'lucide-react';
import { analysisCreditPriceMinor, plans, singleOfferPriceMinor, type PlanSelection } from '@tendr/schemas';
import './pricing-section.css';

type Billing = PlanSelection['billing'];

const czechPrice = new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
});
const price = (minor: number) => czechPrice.format(minor / 100);

const features = {
  pro: [
    `${plans.pro.includedOffers} připravená nabídka každý měsíc`,
    `${plans.pro.includedAnalyses} kredit na analýzu měsíčně`,
    'Matice požadavků s citacemi',
    'Editovatelný návrh a kontrolní seznam',
  ],
  business: [
    `${plans.business.includedAnalyses} kreditů na analýzu měsíčně`,
    `Každá další analýza za ${price(plans.business.extraAnalysisMinor)}`,
    'Filtrování podle priority a oblasti',
    'Export analýz pro sdílení v týmu',
    `Příprava nabídky samostatně za ${price(singleOfferPriceMinor)}`,
  ],
  enterprise: [
    'Objem analýz a nabídek podle potřeb firmy',
    'Týmové role a schvalování nabídek',
    'Vlastní šablony a napojení firemního úložiště',
    'Integrace přes API a jednotné přihlášení',
    'Zaškolení, podpora a SLA podle dohody',
  ],
};

function Features({ items }: { items: readonly string[] }) {
  return <ul className="plan-features">
    {items.map((item) => <li key={item}><Check size={17} aria-hidden="true"/><span>{item}</span></li>)}
  </ul>;
}

export function PricingSection({ singlePrice, onSelectPlan, onOpenAccount, onBuyCredit }: {
  singlePrice: string;
  onSelectPlan: (selection: PlanSelection) => void;
  onOpenAccount: () => void;
  onBuyCredit: () => void;
}) {
  const [billing, setBilling] = useState<Billing>('monthly');
  const annual = billing === 'annual';
  const business = plans.business;
  const savings = business.monthlyMinor * 12 - business.annualMinor;

  return <section className="landing-container pricing-section" id="pricing" aria-labelledby="pricing-title">
    <div className="pricing-heading">
      <div>
        <h2 id="pricing-title">Tarify pro veřejné zakázky</h2>
        <p>Vyberte tarif a požádejte o aktivaci. Podmínky a spuštění potvrdíme po domluvě.</p>
      </div>
      <div className="pricing-billing" role="group" aria-label="Období fakturace">
        <button type="button" className={!annual ? 'active' : undefined} aria-pressed={!annual} onClick={() => setBilling('monthly')}>Měsíčně</button>
        <button type="button" className={annual ? 'active' : undefined} aria-pressed={annual} onClick={() => setBilling('annual')}>Ročně</button>
      </div>
    </div>

    <div className="pricing-plans">
      <article className="plan-card" aria-labelledby="plan-pro-title">
        <span className="plan-icon"><FilePenLine size={21} aria-hidden="true"/></span>
        <h3 id="plan-pro-title">{plans.pro.name}</h3>
        <p className="plan-audience">Pro firmy, které se hlásí zhruba do jedné zakázky měsíčně.</p>
        <div className="plan-price-band">
          <p className="plan-price"><strong>{price(plans.pro.monthlyMinor)}</strong><span>/ měsíc</span></p>
          <p className="plan-price-note">Měsíční tarif</p>
        </div>
        <button className="plan-action secondary" type="button" onClick={() => onSelectPlan({ plan: 'pro', billing: 'monthly' })}>Zvolit Pro <ArrowRight size={17} aria-hidden="true"/></button>
        <Features items={features.pro}/>
      </article>

      <article className="plan-card plan-card-business" aria-labelledby="plan-business-title">
        <span className="plan-icon"><Layers3 size={21} aria-hidden="true"/></span>
        <h3 id="plan-business-title">{business.name}</h3>
        <p className="plan-audience">Pro týmy, které pravidelně vyhodnocují více zakázek.</p>
        <div className="plan-price-band" aria-live="polite">
          <p className="plan-price"><strong>{price(annual ? business.annualMinor : business.monthlyMinor)}</strong><span>{annual ? '/ rok' : '/ měsíc'}</span></p>
          <p className="plan-price-note">{annual ? `Úspora ${price(savings)} za rok` : 'K dispozici i při roční platbě'}</p>
        </div>
        <button className="plan-action primary" type="button" onClick={() => onSelectPlan({ plan: 'business', billing })}>Zvolit Business <ArrowRight size={17} aria-hidden="true"/></button>
        <Features items={features.business}/>
      </article>

      <article className="plan-card plan-card-enterprise" aria-labelledby="plan-enterprise-title">
        <span className="plan-icon"><Building2 size={21} aria-hidden="true"/></span>
        <h3 id="plan-enterprise-title">{plans.enterprise.name}</h3>
        <p className="plan-audience">Pro velké firmy s vlastním procesem schvalování a integracemi.</p>
        <div className="plan-price-band">
          <p className="plan-price"><strong>Na míru</strong></p>
          <p className="plan-price-note">Rozsah nastavíme společně</p>
        </div>
        <button className="plan-action secondary" type="button" onClick={() => onSelectPlan({ plan: 'enterprise', billing: 'monthly' })}>Poptat Enterprise <ArrowRight size={17} aria-hidden="true"/></button>
        <Features items={features.enterprise}/>
      </article>
    </div>

    <div className="pricing-credits">
      <div className="pricing-credit">
        <div><h3>První analýza zdarma</h3><p>Jeden kredit získáte registrací.</p></div>
        <button className="secondary pricing-credit-action" type="button" onClick={onOpenAccount}>Získat kredit <ArrowRight size={16} aria-hidden="true"/></button>
      </div>
      <div className="pricing-credit">
        <div><h3>Jedna analýza za {price(analysisCreditPriceMinor)}</h3><p>Jeden kredit na analýzu, i bez předplatného.</p></div>
        <button className="secondary pricing-credit-action" type="button" onClick={onBuyCredit}>Koupit kredit <ArrowRight size={16} aria-hidden="true"/></button>
      </div>
    </div>

    <div className="one-off-plan">
      <span className="plan-icon"><PanelsTopLeft size={22} aria-hidden="true"/></span>
      <div><h3>Jen jedna nabídka</h3><p>{singlePrice} za přípravu nabídky bez provize z výhry.</p></div>
      <a className="primary" href="#analyza">Vytvořit nabídku <ArrowRight size={17} aria-hidden="true"/></a>
    </div>
  </section>;
}
