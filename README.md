# tendr.ai — první spustitelný milník

České demo auditu veřejné zakázky: syntetický náhled → simulovaná platba → zjištění s citacemi → kvalifikace, finanční scénář, dotazy a checklist. Dvě ukázky: stavební zakázka a IT dodávka.

## Spuštění

Požadavky: Node.js 22+ (ověřeno 24.22.1), pnpm 11.25.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Otevřete http://localhost:5173 a zvolte jednu z ukázkových zakázek. Není potřeba žádný API klíč ani soubor .env. Náhled nevyhledává skutečné zakázky NEN.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Pokud máte systémový Chromium, lze místo stažení prohlížeče spustit:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:e2e
```

## Co je hotové a co se simuluje

Funguje lokální uživatelský průchod, přísná validace reference, výpočty v haléřích, ověřování citovaných pasáží a hash dokumentů. AI, zdroje zakázek a platba jsou výslovně simulované. Demo nepřijímá platební údaje ani soukromé soubory a nevytváří produkční oprávnění. Data relace se po obnovení stránky ztratí.

Exporty: JSON report, Markdown zdroje/checklist a TXT návrh dotazů; Tisk/PDF používá prohlížeč. Nativní PDF a DOCX nejsou implementované.

Supabase migrace a negativní SQL testy jsou připravený základ, zatím nejsou připojené k aplikaci. Docker ani Supabase CLI zde nejsou dostupné; databázové testy nebyly spuštěny. Přihlášení, skutečné NEN/Apify/Gemini integrace, Stripe webhook, trvalá fronta a worker zbývají. Produkt není připravený pro produkční provoz.

Přesný stav a výsledky kontrol: [docs/PROGRESS.md](docs/PROGRESS.md). Architektura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Následující práce: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Cloudflare Workers

Repozitář obsahuje `wrangler.jsonc` pro aktuální projekt Worker `tendr-ai`. Příkaz `npx wrangler deploy` nejprve automaticky spustí `pnpm build` a potom nahraje `apps/web/dist`. V dashboardu může pole Build command zůstat prázdné; Deploy command ponechte `npx wrangler deploy`, kořen `/`. Tato konfigurace nasazuje pouze statické demo.
