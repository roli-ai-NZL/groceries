# Roland's groceries

A personal weekly grocery dashboard for Sydney shops. Keep a running list, turn a **recipe name** into ingredients, estimate a Coles / Woolworths bill, then hand a cart-fill payload to an external shopping agent (Shappy).

The app does **not** log into Coles or Woolworths. The agent adds items to the trolley only. Checkout and payment stay with you.

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

1. **Weekly list** — standing staples load automatically (meat, produce, fridge, bread, pantry). Use the **− / +** steppers on each row to set a count (`2×` onions, `5×` onions) without retyping the name. Optional **unit / size** lives in Edit (`kg`, `punnet`, pack size like `1.4kg`) so “5× onions” and “1.4kg brisket” both work. Notes and store preference (Coles / Woolies / Either) are unchanged. **Check = select** for Estimate, Prepare order, and Fill carts (not “already bought”). Older free-text quantities (`x2`, `~600g`, `1.4kg`) are split into count + unit when the list loads.
2. **Every few weeks / monthly** — butter, oats, block cheese, minced garlic, stock, duck fat, pesto, sun-dried tomatoes, tomato paste, red wine, tortillas. These stay in their own sections. Toggle **Include this week** when you need them.
3. **Recipe → ingredients** — type a dish name (for example `bolognese` or `carbonara`). The app looks up a typical version via [TheMealDB](https://www.themealdb.com/) (free, no key). Review counts and units, drop lines, or mark “already have”, then merge. Matching names add counts when the unit is the same, and still combine weights (`500g` + `250g` → `750g`) when the units are compatible.
4. **Reset week** — reloads the standing weekly staples and clears recipe/custom weekly items. Occasional and monthly include-toggles and store prefs are kept.
5. **Estimate bill** — prices **checked** items against Coles and Woolworths public product search (no cart, no login). Check the rows you want priced, then open Estimate. Shows best-match product, pack size, AUD price, specials, and a store link. Totals for a Coles basket, a Woolies basket, and a cheapest mix. Swap an alternate match if the top hit looks wrong. Respects Coles / Woolies / Either preferences (the other store still appears as a comparison).
6. **Prepare Coles / Woolies order** — copy a clean list or download JSON of the **same checked items**. An external agent can add those to a trolley; you review substitutions/specials and check out yourself. If nothing is checked, the dialog tells you to tick items first.
7. **Fill Coles / Woolies carts** — the shopping-agent handoff. Same checked selection as Estimate / Prepare. Shows counts per store (Coles-only, Woolies-only, Either), a copyable checklist, JSON download, and a **Copy agent brief** for Shappy. Copy: *Agent adds to trolley only — you review and checkout.* Either-preference items stay in an Either bucket so the agent picks one store (do not double-add). Optional matched product id/url from the last Estimate is included when still cached.
8. **Export / import list** — backup or restore the full list as JSON.

### Estimate caveat

The bill is an **estimate**. Pack sizes and substitutions can differ from what you actually put in a trolley. Prices come from the same public search the store websites use and can change. Nothing is added to a cart and checkout stays with you. Results cache for about four hours so repeat estimates are gentle on the stores.

Woolworths (Akamai) often blocks datacentre IPs such as Vercel. The app does **not** treat that as a $0 Woolies basket:

1. **Direct search** — warms a browser-like session on `/shop` and `/shop/browse/fruit-vegetables`, sends Chrome / `en-AU` headers, and retries once after a re-warm on 403, empty, or connection reset.
2. **Apify fallback** — if direct search is still blocked and `APIFY_TOKEN` is set, Estimate prices the list in one pass via a few [crawlerbros/woolworths-au-scraper](https://apify.com/crawlerbros/woolworths-au-scraper) runs (free Apify account; uses their datacentre proxy). The first Estimate can take about a minute.
3. **Explicit error** — if still blocked, Estimate shows **Woolies unavailable** plus the real Apify reason when a token is set (unauthorized / payment / actor missing / timeout). Coles prices still appear.

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
4. In Vercel: Project → Settings → Environment Variables → add `APIFY_TOKEN` for Production and Preview → **Redeploy** (new env vars are not picked up until the next deploy).
5. Open [crawlerbros/woolworths-au-scraper](https://apify.com/crawlerbros/woolworths-au-scraper) in the Apify console once and accept / try the actor. Store actors often need that first console open before an API token can run them.

Default actor: `crawlerbros/woolworths-au-scraper`. Estimate **does not** start one sync actor run per grocery line. It posts the whole list to `/api/prices/estimate`, then:

- tries Woolies directly
- if Akamai still blocks, starts **one async Apify run per unique search** when there are ≤4 queries, or **one `byCategory` run per grocery department** (typically 4–6) plus a few targeted fill-in searches for weak matches
- polls the dataset instead of `run-sync-get-dataset-items` (those 55s sync calls were timing out on Vercel Hobby)
- memoizes identical / in-flight queries for the life of the process (about four hours for successful datasets)

Expected latency: Coles is still a few seconds. The first Woolies-via-Apify Estimate is often **30–60 seconds**. Later Estimates reuse the server and browser caches.

Free-tier Apify limits still apply (compute + pay-per-result on the actor). A full-list fallback is a handful of runs, not 25. If credits or rental fail, Estimate shows the real reason (`401 unauthorized`, `402 payment required`, `404 actor not found`, timeout) instead of a generic “Apify fallback failed”.

Override with `APIFY_WOOLWORTHS_ACTOR` if you prefer another search actor (for example `dromb/woolworths-au-product-search-catalog-unofficial`, which expects `{ "operation": "search", "query": "<item>" }`). Alternate actors are search-only.

Add `?debug=1` to `/api/prices/search` or `/api/prices/estimate` to include `debug.apify` (`tokenPresent` boolean, `actorId`, `lastErrorCode`, `lastErrorStatus`, `runsStarted`, `strategy`). The token value is never returned.

Without a token, a blocked Woolies lookup shows **Woolworths blocked this server (Akamai)** plus how to add Apify. Coles is unchanged and still priced.

## Shopping-agent JSON

**Fill carts** and **Prepare order** download the same payload: **checked items only**, for an external cart-filling agent such as Shappy. The agent may log in to add to a trolley. It must **stop before checkout and payment**.

```json
{
  "timezone": "Australia/Sydney",
  "shopper": "Roland",
  "locale": "en-AU",
  "instructions": "Add these items to a Coles and/or Woolworths trolley only. Stop before checkout and payment. …",
  "items": [
    {
      "name": "Brisket",
      "quantity": "1.4kg",
      "count": 1,
      "unit": "1.4kg",
      "category": "Meat",
      "store": "Coles",
      "matched": {
        "coles": { "id": "…", "name": "…", "url": "https://www.coles.com.au/…", "packSize": "1.4kg" }
      }
    }
  ],
  "byCategory": {},
  "byStore": {
    "Coles": [],
    "Woolworths": [],
    "Either": []
  }
}
```

`byStore` always includes those three keys. Coles-only and Woolies-only stay in their lists. **Either** is a shared bucket — the agent chooses one supermarket and should not add the same line to both trolleys. `matched` is omitted when there is no last-Estimate cache hit.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · localStorage for v1.
