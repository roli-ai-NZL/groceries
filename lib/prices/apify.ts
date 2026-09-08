import { rankMatches, searchQueryFor } from "./match";
import type { PricedProduct, StoreSearchResult } from "./types";
import { WOOLWORTHS_APIFY_FAILED, WOOLWORTHS_UNAVAILABLE_NO_TOKEN } from "./woolworths-errors";

export const DEFAULT_WOOLWORTHS_APIFY_ACTOR = "crawlerbros/woolworths-au-scraper";

type EnvMap = Record<string, string | undefined>;

export function getApifyToken(env: EnvMap = process.env): string {
  return env.APIFY_TOKEN?.trim() ?? "";
}

export function getWoolworthsApifyActor(env: EnvMap = process.env): string {
  return env.APIFY_WOOLWORTHS_ACTOR?.trim() || DEFAULT_WOOLWORTHS_APIFY_ACTOR;
}

export function apifyActorPath(actorId: string): string {
  return actorId.replace("/", "~");
}

export function buildWoolworthsApifyInput(actorId: string, query: string): Record<string, unknown> {
  if (actorId.includes("crawlerbros")) {
    return {
      mode: "search",
      searchQuery: query,
      maxItems: 12,
      onSaleOnly: false,
    };
  }
  return {
    operation: "search",
    query,
    page: 1,
    includeRaw: false,
  };
}

function numberish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function textish(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function mapApifyProduct(raw: unknown): Omit<PricedProduct, "confidence"> | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = textish(item.productId, item.Stockcode, item.id, item.sku);
  const name = textish(item.name, item.DisplayName, item.Name);
  if (!id || !name) return null;

  const discount = numberish(item.discount_price);
  const regular = numberish(item.price ?? item.Price ?? item.InstorePrice);
  const original = numberish(item.originalPrice ?? item.WasPrice);
  let price = discount ?? regular;
  let wasPrice = original && price != null && original > price ? original : null;
  if (discount != null && regular != null && regular > discount) {
    price = discount;
    wasPrice = regular;
  }
  if (price == null) return null;

  const packSize = textish(item.unit, item.size, item.PackageSize, item.Unit) || "1 pack";
  const slug = textish(item.slug, item.UrlFriendlyName) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const productUrl = textish(item.productUrl, item.source_url, item.url);
  const onSpecial = Boolean(
    item.isOnSale || item.IsOnSpecial || item.IsHalfPrice || (wasPrice != null && wasPrice > price),
  );

  return {
    store: "Woolworths",
    id,
    name,
    brand: textish(item.brand, item.Brand) || undefined,
    packSize,
    price,
    wasPrice,
    unitPriceLabel: textish(item.pricePerUnit, item.unit_price, item.CupString) || undefined,
    onSpecial,
    url: productUrl || `https://www.woolworths.com.au/shop/productdetails/${id}/${slug}`,
    image: textish(item.imageUrl, item.image, item.MediumImageFile, item.SmallImageFile) || undefined,
    available: item.inStock !== false && item.IsAvailable !== false && item.is_available !== false,
    weighted: /kg|approx/i.test(packSize),
  };
}

export function mapApifyItems(
  items: unknown[],
  query: string,
  quantity?: string,
  category?: string,
): PricedProduct[] {
  const products = items
    .map(mapApifyProduct)
    .filter((item): item is Omit<PricedProduct, "confidence"> => Boolean(item));
  return rankMatches(query, products, quantity, category);
}

type FetchFn = typeof fetch;

export async function searchWoolworthsViaApify(
  name: string,
  quantity?: string,
  category?: string,
  options?: { fetch?: FetchFn; env?: EnvMap },
): Promise<StoreSearchResult> {
  const env = options?.env ?? process.env;
  const token = getApifyToken(env);
  if (!token) {
    return { store: "Woolworths", matches: [], error: WOOLWORTHS_UNAVAILABLE_NO_TOKEN };
  }

  const query = searchQueryFor(name, quantity, category);
  const actor = getWoolworthsApifyActor(env);
  const url = `https://api.apify.com/v2/acts/${apifyActorPath(actor)}/run-sync-get-dataset-items`;
  const fetchImpl = options?.fetch ?? fetch;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(buildWoolworthsApifyInput(actor, query)),
      signal: AbortSignal.timeout(55000),
      cache: "no-store",
    });

    if (!response.ok) {
      return { store: "Woolworths", matches: [], error: WOOLWORTHS_APIFY_FAILED };
    }

    const payload = (await response.json()) as unknown;
    const items = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];

    let matches = mapApifyItems(items, query, quantity, category);
    if (!matches.length && query.toLowerCase() !== name.toLowerCase()) {
      matches = mapApifyItems(items, name, quantity, category);
    }
    if (!matches.length) {
      return { store: "Woolworths", matches: [], error: WOOLWORTHS_APIFY_FAILED };
    }
    return { store: "Woolworths", matches };
  } catch {
    return { store: "Woolworths", matches: [], error: WOOLWORTHS_APIFY_FAILED };
  }
}
