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

If Woolworths returns “blocked” from some networks (their Akamai bot filter), retry from a home / Australian connection. Coles usually works without that.

### Pasta / bolognese note

Jarred sauce (Dolmio and similar) already has tomato, herbs, and often garlic. Tomato paste is optional for bolognese — use it for a deeper, thicker sauce, or skip it for one less jar.

## Optional Spoonacular key

TheMealDB is the default and needs no key. To try Spoonacular when TheMealDB has no match, copy `.env.example` to `.env.local` and set:

```bash
SPOONACULAR_API_KEY=your_key
```

Restart `npm run dev` after changing env files.

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
