// @vitest-environment jsdom
import {beforeAll,it,expect} from 'vitest';
import {screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {webcrypto} from 'node:crypto';
beforeAll(async()=>{
 document.body.innerHTML='<div id="root"></div>';
 Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
 window.scrollTo=()=>{};
 await import('../../apps/web/src/main');
});
it('prepares a sourced requirements matrix and hands off the bid after simulated review',async()=>{
 const user=userEvent.setup();
 await screen.findByRole('heading',{name:/Nabídka na klíč/});
 expect(screen.getByText(/9\s999\sKč za nabídku/)).toBeTruthy();
 await user.type(screen.getByLabelText('Číslo veřejné zakázky'),'invalid');
 await user.click(screen.getByRole('button',{name:'Zanalyzovat zakázku'}));
 expect((await screen.findByRole('alert')).textContent).toContain('N006');
 await user.click(screen.getByTestId('fixture-construction'));
 await screen.findByRole('heading',{name:'Dostupná dokumentace'});
 await user.click(screen.getByRole('button',{name:'Připravit ukázkovou nabídku'}));
 expect(screen.getByRole('dialog').textContent).toContain('Simulovaná platba');
 await user.click(screen.getByTestId('simulate-payment'));
 const review=await screen.findByRole('button',{name:'Simulovat kontrolu specialistkou'});
 expect(screen.queryByRole('button',{name:'Stáhnout balíček nabídky'})).toBeNull();
 expect(screen.getByRole('row',{name:/Rozpor v termínu dokončení/}).textContent).toContain('31. 7. 2027');
 await user.click(review);
 const offer = await screen.findByRole<HTMLTextAreaElement>('textbox',{name:'Upravit návrh nabídky'});
 expect(offer.value).toContain('položkový rozpočet a harmonogram');
 expect(offer.value).toContain('N006/26/V00018665');
 for(const form of ['Krycí list','Čestná prohlášení','Seznam referencí','jednotné evropské osvědčení']){
  expect(offer.value).toContain(form);
 }
 await user.type(offer,'Pracovní poznámka dodavatele');
 await user.click(screen.getByRole('tab',{name:'Analýza podkladů'}));
 await screen.findByRole('heading',{name:'Pokračovat po vyjasnění podmínek'});
 expect(document.querySelector('.calc-total')?.textContent).toContain('727');
 const evidence=document.querySelector<HTMLButtonElement>('.evidence-links button')!;
 await user.click(evidence);
 expect(screen.getByRole('dialog').textContent).toContain('SYNTETICKÁ DEMO');
 await user.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 await user.click(screen.getByRole('tab',{name:'Kvalifikace'}));
 expect(screen.getByText('Chybí důkaz')).toBeTruthy();
 await user.click(screen.getByRole('tab',{name:'Dotazy zadavateli'}));
 await user.click(screen.getByRole('button',{name:'Vytvořit návrh ze zjištění'}));
 expect((screen.getByLabelText('Upravit návrh dotazů') as HTMLTextAreaElement).value).toContain('N006/26/V00018665');
 await user.click(screen.getByRole('tab',{name:'Balíček nabídky'}));
 expect(screen.getByRole<HTMLTextAreaElement>('textbox',{name:'Upravit návrh nabídky'}).value).toContain('Pracovní poznámka dodavatele');
 await user.click(screen.getByRole('button',{name:'tendr.ai úvod'}));
 await user.click(screen.getByTestId('fixture-it'));
 expect(screen.queryByRole('button',{name:'Export JSON'})).toBeNull();
 await user.click(screen.getByRole('button',{name:'Připravit ukázkovou nabídku'}));
 await user.click(screen.getByTestId('simulate-payment'));
 await user.click(await screen.findByRole('button',{name:'Simulovat kontrolu specialistkou'}));
 const itOffer = await screen.findByRole<HTMLTextAreaElement>('textbox',{name:'Upravit návrh nabídky'});
 expect(itOffer.value).toContain('SLA, plán migrace a bezpečnostní koncepci');
 expect(itOffer.value).not.toContain('Pracovní poznámka dodavatele');
});
