import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('construction journey: bid editing and export with supporting analysis',async({page})=>{
 await page.goto('/');
 await page.getByTestId('fixture-construction').click();
 await expect(page.getByRole('heading',{name:'Dostupná dokumentace'})).toBeVisible();
 await page.getByRole('button',{name:'Připravit ukázkovou nabídku',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Simulovaná platba');
 await expect(page.getByRole('dialog')).toContainText(/9\s999\sKč/);
 await page.getByTestId('simulate-payment').click();
 const attachments=page.getByRole('row',{name:/Povinné přílohy/});
 await expect(attachments).toContainText('položkový rozpočet a harmonogram');
 await attachments.getByRole('button',{name:/Technická specifikace/}).click();
 await expect(page.getByRole('dialog')).toContainText('Nabídka musí obsahovat položkový rozpočet a harmonogram.');
 await page.getByRole('button',{name:'Zavřít zdroj'}).click();
 await expect(page.getByRole('button',{name:'Stáhnout balíček nabídky'})).toHaveCount(0);
 await page.getByRole('button',{name:'Simulovat kontrolu specialistkou'}).click();
 const offer=page.getByRole('textbox',{name:'Upravit návrh nabídky'});
 await expect(offer).toHaveValue(/položkový rozpočet a harmonogram/);
 await offer.fill('Upravený pracovní návrh');
 const bidDownloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Stáhnout balíček nabídky'}).click();
 const bid=await bidDownloadPromise;
 expect(bid.suggestedFilename()).toBe('nabidka-N006-26-V00018665.md');
 expect(await readFile(await bid.path(),'utf8')).toBe('Upravený pracovní návrh');
 await page.emulateMedia({media:'print'});
 await expect(page.locator('.offer-print')).toBeVisible();
 await expect(page.locator('.offer-print')).toHaveText('Upravený pracovní návrh');
 await expect(page.getByRole('heading',{name:'Matice požadavků'})).toBeHidden();
 await expect(offer).toBeHidden();
 await page.emulateMedia({media:'screen'});
 await page.getByRole('tab',{name:'Analýza podkladů'}).click();
 await expect(page.getByRole('heading',{name:'Pokračovat po vyjasnění podmínek'})).toBeVisible();
 await expect(page.locator('.calc-total')).toContainText('727');
 await page.locator('.evidence-links button').first().click();
 await expect(page.getByRole('dialog')).toContainText('SYNTETICKÁ DEMO');
 await page.getByRole('button',{name:'Zavřít zdroj'}).click();
 await page.getByRole('tab',{name:'Kvalifikace',exact:true}).click();
 await expect(page.getByText('Chybí důkaz', {exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Dotazy zadavateli'}).click();
 await page.getByRole('button',{name:'Vytvořit návrh ze zjištění'}).click();
 await expect(page.getByLabel('Upravit návrh dotazů')).toHaveValue(/N006\/26\/V00018665/);
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export JSON'}).click();
 const file=await downloadPromise;
 expect(file.suggestedFilename()).toBe('audit-N006-26-V00018665.json');
 await page.reload();
 await expect(page.getByRole('button',{name:'Připravit ukázkovou nabídku',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Export JSON'})).toHaveCount(0);
});
test('validation and IT fixture on mobile',async({page})=>{
 await page.setViewportSize({width:1024,height:900});await page.goto('/');
 await expect(page.getByRole('heading',{name:/Nabídka na klíč/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByLabel('Číslo veřejné zakázky').fill('not-a-reference');
 await page.getByRole('button',{name:'Zanalyzovat zakázku',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible();
 await page.getByTestId('fixture-it').click();
 await page.getByRole('button',{name:'Připravit ukázkovou nabídku',exact:true}).click();
 await page.getByTestId('simulate-payment').click();
 await page.getByRole('button',{name:'Simulovat kontrolu specialistkou'}).click();
 await expect(page.getByRole('textbox',{name:'Upravit návrh nabídky'})).toHaveValue(/plán migrace/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('NEN intake sends just the reference and shows the sourced result',async({page})=>{
 const reference='N006/26/V00018665';
 const quote='Lhůta pro podání nabídek končí 18. 12. 2026 v 9:00.';
 await page.route('**/api/nen/analysis',async route=>{
  if (route.request().method()==='GET') {
   await route.fulfill({json:{available:true}});
   return;
  }
  expect(route.request().postDataJSON()).toEqual({reference});
  await route.fulfill({
   contentType:'application/x-ndjson',
   body:[
    {type:'progress',stage:'reading',detail:'Čteme výzvu.'},
    {type:'result',report:{
     reference,title:'Testovací zakázka',authority:null,checkedAt:'2026-11-25T11:00:00.000Z',
     bibliography:[{id:'F1.1',fileId:'F1',name:'Výzva.pdf',version:'1',locator:'Strana 2'}],
     files:[{id:'F1',name:'Výzva.pdf',status:'partial',notes:['Strana 4 vyžaduje OCR.']}],
     gaps:[],rejectedFindings:0,
     findings:[{id:'R1',category:'submission',severity:'critical',title:'Lhůta pro podání',
      requirement:quote,impact:'Po lhůtě se nabídka nevyhodnotí.',action:'Naplánujte podání s předstihem.',
      evidence:[{documentId:'F1.1',version:'1',locator:'Strana 2',quote}]}],
    }},
   ].map(event=>JSON.stringify(event)).join('\n')+'\n',
  });
 });
 await page.goto('/');
 await page.getByRole('textbox',{name:'Číslo veřejné zakázky'}).fill('n006-26-v00018665');
 await page.getByRole('button',{name:'Zanalyzovat zakázku'}).click();
 await expect(page.getByRole('heading',{name:'Testovací zakázka'})).toBeVisible();
 await expect(page.getByText('Naplánujte podání s předstihem.')).toBeVisible();
 await page.getByText('Výzva.pdf · Strana 2').click();
 await expect(page.locator('blockquote')).toHaveText(quote);
 await expect(page.getByText('Strana 4 vyžaduje OCR.')).toBeVisible();
});
