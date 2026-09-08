import { getApifyDebug } from "@/lib/prices/apify";
import { estimatePrices, type EstimatePriceInput } from "@/lib/prices/search";

export const dynamic = "force-dynamic";
/** One Estimate pass: Coles in parallel, Woolies via few async Apify runs when blocked. Expect ~15–60s. */
export const maxDuration = 60;

const MAX_ITEMS = 60;

type BodyItem = {
  id?: unknown;
  name?: unknown;
  qty?: unknown;
  quantity?: unknown;
  category?: unknown;
};

function readItems(body: unknown): EstimatePriceInput[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const parsed: EstimatePriceInput[] = [];
  for (const raw of items.slice(0, MAX_ITEMS)) {
    const item = raw as BodyItem;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!name || !id) continue;
    parsed.push({
      id,
      name,
      quantity: typeof item.qty === "string" ? item.qty : typeof item.quantity === "string" ? item.quantity : "",
      category: typeof item.category === "string" ? item.category : "",
    });
  }
  return parsed;
}

export async function POST(request: Request) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const items = readItems(body);
  if (!items) {
    return Response.json({ error: "Missing items." }, { status: 400 });
  }
  if (!items.length) {
    return Response.json(debug ? { results: [], debug: { apify: getApifyDebug() } } : { results: [] });
  }

  const refresh = Boolean((body as { refresh?: unknown }).refresh);

  try {
    const result = await estimatePrices(items, refresh);
    if (debug) {
      return Response.json({ ...result, debug: { apify: getApifyDebug() } });
    }
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price lookup failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
