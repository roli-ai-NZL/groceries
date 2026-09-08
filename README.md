# Roland's groceries

A personal weekly grocery dashboard for Sydney shops. Keep a running list, turn a **recipe name** into ingredients, then export a Coles / Woolworths cart payload for an external shopping agent.

The app does **not** log into Coles or Woolworths. Checkout and payment stay with you.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No account is required. The list is saved in `localStorage` on this device.

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint
npm test        # quantity parse / merge / seed checks
```

## How to use it

1. **Weekly list** — standing staples load automatically (meat, produce, fridge, bread, pantry). Use the **− / +** steppers on each row to set a count (`2×` onions, `5×` onions) without retyping the name. Optional **unit / size** lives in Edit (`kg`, `punnet`, pack size like `1.4kg`) so “5× onions” and “1.4kg brisket” both work. Notes and store preference (Coles / Woolies / Either) are unchanged. Check items off as they go in the cart or get bought. Older free-text quantities (`x2`, `~600g`, `1.4kg`) are split into count + unit when the list loads.
2. **Every few weeks / monthly** — butter, oats, block cheese, minced garlic, stock, duck fat, pesto, sun-dried tomatoes, tomato paste, red wine, tortillas. These stay in their own sections. Toggle **Include this week** when you need them.
3. **Recipe → ingredients** — type a dish name (for example `bolognese` or `carbonara`). The app looks up a typical version via [TheMealDB](https://www.themealdb.com/) (free, no key). Review counts and units, drop lines, or mark “already have”, then merge. Matching names add counts when the unit is the same, and still combine weights (`500g` + `250g` → `750g`) when the units are compatible.
4. **Reset week** — reloads the standing weekly staples and clears recipe/custom weekly items. Occasional and monthly include-toggles and store prefs are kept.
5. **Estimate bill** — prices unchecked items against Coles and Woolworths public product search (no cart, no login). Shows best-match product, pack size, AUD price, specials, and a store link. Totals for a Coles basket, a Woolies basket, and a cheapest mix. Swap an alternate match if the top hit looks wrong. Respects Coles / Woolies / Either preferences (the other store still appears as a comparison).
6. **Prepare Coles / Woolies order** — copy a clean list or download JSON of unchecked, included items. An external agent can add those to a cart; you review substitutions/specials and check out yourself.
7. **Export / import list** — backup or restore the full list as JSON.

### Estimate caveat

The bill is an **estimate**. Pack sizes and substitutions can differ from what you actually put in a trolley. Prices come from the same public search the store websites use and can change. Nothing is added to a cart and checkout stays with you. Results cache for about four hours so repeat estimates are gentle on the stores.

Woolworths (Akamai) often blocks datacentre IPs such as Vercel. The app does **not** treat that as a $0 Woolies basket:

1. **Direct search** — warms a browser-like session on `/shop` and `/shop/browse/fruit-vegetables`, sends Chrome / `en-AU` headers, and retries once after a re-warm on 403, empty, or connection reset.
2. **Apify fallback** — if direct search is still blocked and `APIFY_TOKEN` is set, prices come from the [crawlerbros/woolworths-au-scraper](https://apify.com/crawlerbros/woolworths-au-scraper) actor (free Apify account; uses their datacentre proxy).
3. **Explicit error** — if still blocked and there is no token, Estimate shows **Woolies unavailable** and how to add Apify. Coles prices still appear.

See [Woolworths prices on hosted deploys](#woolworths-prices-on-hosted-deploys) below.

### Pasta / bolognese note

Jarred sauce (Dolmio and similar) already has tomato, herbs, and often garlic. Tomato paste is optional for bolognese — use it for a deeper, thicker sauce, or skip it for one less jar.

## Optional Spoonacular key

TheMealDB is the default and needs no key. To try Spoonacular when TheMealDB has no match, copy `.env.example` to `.env.local` and set:

```bash
SPOONACULAR_API_KEY=your_key
```

Restart `npm run dev` after changing env files.

## Woolworths prices on hosted deploys

Coles public search usually works from Vercel. Woolworths sits behind Akamai and often returns HTML “Access Denied” from cloud IPs, which used to show up as a silent $0 Woolies basket.

### Path 1 — Direct (no extra account)

The server now pretends to be a Chrome browser in Australia: `en-AU`, `sec-fetch-*` / `sec-ch-ua` headers, and a warmed cookie jar from `GET /shop` then `GET /shop/browse/fruit-vegetables` before `POST /apis/ui/Search/products`. A 403, empty payload, or connection reset triggers one re-warm and retry.

If that works from your host, you do not need Apify.

### Path 3 — Optional Apify fallback

When direct search is still blocked, set `APIFY_TOKEN` so Estimate can call a Woolworths AU search actor.

1. Create a free account at [Apify](https://console.apify.com/sign-up).
2. Open [API & Integrations](https://console.apify.com/settings/integrations) and create a personal API token.
3. Copy `.env.example` to `.env.local` and set `APIFY_TOKEN=...` for local runs.
4. In Vercel: Project → Settings → Environment Variables → add `APIFY_TOKEN` for Production and Preview → **Redeploy**.

Default actor: `crawlerbros/woolworths-au-scraper`. Input used:

```json
{ "mode": "search", "searchQuery": "<item>", "maxItems": 12, "onSaleOnly": false }
```

Override with `APIFY_WOOLWORTHS_ACTOR` if you prefer another search actor (for example `dromb/woolworths-au-product-search-catalog-unofficial`, which expects `{ "operation": "search", "query": "<item>" }`).

The actor run is slower than a direct POST (one run per item). Hobby-plan Vercel functions may time out; the price route sets `maxDuration` to 60 seconds for Pro. Free-plan Apify credits cover light personal use; each lookup spends a small amount of compute plus pay-per-result on the actor.

Without a token, a blocked Woolies lookup shows **Woolworths blocked this server (Akamai)** plus how to add Apify. Coles is unchanged and still priced.

## Shopping-agent JSON

The “Prepare order” download is meant for a later cart-filling agent. Shape:

```json
{
  "timezone": "Australia/Sydney",
  "shopper": "Roland",
  "instructions": "…cart only; human completes checkout…",
  "items": [
    { "name": "Brisket", "quantity": "1.4kg", "count": 1, "unit": "1.4kg", "category": "Meat", "store": "Either" }
  ],
  "byCategory": {},
  "byStore": {}
}
```

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · localStorage for v1.
