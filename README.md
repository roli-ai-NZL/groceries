# Roland's groceries

A personal weekly grocery dashboard for Sydney shops. Keep a running list, turn a **recipe name** into ingredients, then export a Coles / Woolworths cart payload for an external shopping agent.

The app does **not** log into Coles or Woolworths. Checkout and payment stay with you.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No account is required. Without extra setup the list is saved in `localStorage` on this device. To share one list across phone and laptop, add free Supabase sync below.

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint
```

## Cloud sync (free Supabase)

One shared weekly list across devices: items, quantities, categories, checked state, store preference, and occasional/monthly include toggles.

Auth is a **household access code** (a passphrase you choose). It is stored in Postgres as a bcrypt hash. The table is not publicly readable or writable — the app can only call two server functions, and those only succeed with the correct code. There is no magic-link login and no service-role key.

If the Supabase env vars are missing, the app behaves exactly as before (this device only).

### 1. Create a free Supabase project

1. Sign in at [https://supabase.com](https://supabase.com) and **New project**.
2. Wait until the project is ready. The free tier is enough.

### 2. Run the schema

1. In the Supabase dashboard open **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Replace `YOUR_HOUSEHOLD_ACCESS_CODE` with a long passphrase you will type on phone and laptop (at least 6 characters; longer is better). This is **not** your email password.
4. Run the query once.

Re-running the file will not overwrite an existing list or passphrase. To change the code later:

```sql
update public.household_lists
set passphrase_hash = crypt('NEW_HOUSEHOLD_ACCESS_CODE', gen_salt('bf'))
where id = 'roland';
```

Then unlock again on each device.

### 3. Copy the API keys

In Supabase go to **Project Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do **not** put the `service_role` key in Vercel or the app. It is not needed.

### 4. Local env

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Restart `npm run dev`. Open the app, enter the household access code, and unlock sync.

### 5. Vercel

In the Vercel project: **Settings → Environment Variables**. Add the same two `NEXT_PUBLIC_…` values for **Production** (and Preview if you use it). Redeploy so the new values are baked into the client.

After deploy, open the live site on phone and laptop, enter the same access code on each, and pick **upload this device** or **use the cloud list** the first time both already have data.

### How sync behaves

- Status pill: **Synced** / **Syncing** / **Offline** / **Error** / **This device only**.
- Edits save to this device immediately, then debounce (~800ms) to the cloud.
- Conflicts use **last write wins**. The pill shows when the cloud list was last saved (Sydney time). **Reload from cloud** is in the pill menu if you need the other device’s copy.
- First connect: empty cloud → this device uploads. New device with no local save → downloads. Both already have a list → you choose.
- Offline keeps working on `localStorage` and pushes when the network returns.

The access code is kept in an http-only cookie on that browser for a year. **Stop syncing on this device** in the pill menu forgets it.

## How to use it

1. **Weekly list** — standing staples load automatically (meat, produce, fridge, bread, pantry). Edit names, quantities, notes, and store preference (Coles / Woolies / Either). Check items off as they go in the cart or get bought.
2. **Every few weeks / monthly** — butter, oats, block cheese, minced garlic, stock, duck fat, pesto, sun-dried tomatoes, tomato paste, red wine, tortillas. These stay in their own sections. Toggle **Include this week** when you need them.
3. **Recipe → ingredients** — type a dish name (for example `bolognese` or `carbonara`). The app looks up a typical version via [TheMealDB](https://www.themealdb.com/) (free, no key). Review quantities, drop lines, or mark “already have”, then merge. Matching names combine quantities when the units are obvious.
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
    { "name": "Brisket", "quantity": "1.4kg", "category": "Meat", "store": "Either" }
  ],
  "byCategory": {},
  "byStore": {}
}
```

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · localStorage, plus optional Supabase (free tier) for cross-device sync.
