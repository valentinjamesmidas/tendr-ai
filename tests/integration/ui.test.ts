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
it('runs actual UI from input error to preview, simulated audit, source and clarification',async()=>{
 const user=userEvent.setup();
 await screen.findByRole('heading',{name:/Zakázka začíná číslem/});
 await user.type(screen.getByLabelText('Číslo veřejné zakázky'),'invalid');
 await user.click(screen.getByRole('button',{name:'Prověřit zakázku'}));
 expect((await screen.findByRole('alert')).textContent).toContain('N006');
 await user.click(screen.getByTestId('fixture-construction'));
 await screen.findByRole('heading',{name:'Dostupná dokumentace'});
 await user.click(screen.getByRole('button',{name:'Spustit demo audit'}));
 expect(screen.getByRole('dialog').textContent).toContain('Simulovaná platba');
 await user.click(screen.getByTestId('simulate-payment'));
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
 await user.click(screen.getByRole('button',{name:'tendr.ai úvod'}));
 await user.click(screen.getByTestId('fixture-it'));
 expect(screen.queryByRole('button',{name:'Export JSON'})).toBeNull();
 expect(screen.getByRole('button',{name:'Spustit demo audit'})).toBeTruthy();
});
