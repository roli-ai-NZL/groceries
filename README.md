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
```

## How to use it

1. **Weekly list** — standing staples load automatically (meat, produce, fridge, bread, pantry). Edit names, quantities, notes, and store preference (Coles / Woolies / Either). Check items off as they go in the cart or get bought.
2. **Every few weeks / monthly** — butter, oats, block cheese, minced garlic, stock, duck fat, pesto, sun-dried tomatoes, tomato paste, red wine, tortillas. These stay in their own sections. Toggle **Include this week** when you need them.
3. **Recipe → ingredients** — type a dish name (for example `bolognese` or `carbonara`). The app looks up a typical version via [TheMealDB](https://www.themealdb.com/) (free, no key). Review quantities, drop lines, or mark “already have”, then merge. Matching names combine quantities when the units are obvious.
4. **Reset week** — reloads the standing weekly staples and clears recipe/custom weekly items. Occasional and monthly include-toggles and store prefs are kept.
5. **Prepare Coles / Woolies order** — copy a clean list or download JSON of unchecked, included items. An external agent can add those to a cart; you review substitutions/specials and check out yourself.
6. **Export / import list** — backup or restore the full list as JSON.

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
    { "name": "Brisket", "quantity": "1.4kg", "category": "Meat", "store": "Either" }
  ],
  "byCategory": {},
  "byStore": {}
}
```

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · localStorage for v1.
