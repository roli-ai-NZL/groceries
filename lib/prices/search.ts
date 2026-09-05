import { searchColes } from "./coles";
import { PRICE_CACHE_TTL_MS, type PriceSearchResponse } from "./types";
import { searchWoolworths } from "./woolworths";

type CacheEntry = { expires: number; value: PriceSearchResponse };
const memory = new Map<string, CacheEntry>();

function cacheKey(name: string, quantity: string, category: string) {
  return `${name.toLowerCase().trim()}|${quantity.toLowerCase().trim()}|${category}`;
}

export function getCachedPrice(name: string, quantity: string, category = ""): PriceSearchResponse | null {
  const entry = memory.get(cacheKey(name, quantity, category));
  if (!entry || entry.expires < Date.now()) {
    if (entry) memory.delete(cacheKey(name, quantity, category));
    return null;
  }
  return { ...entry.value, cached: true };
}

export function setCachedPrice(value: PriceSearchResponse, quantity: string, category = "") {
  memory.set(cacheKey(value.query, quantity, category), {
    expires: Date.now() + PRICE_CACHE_TTL_MS,
    value,
  });
}

export async function searchPrices(
  name: string,
  quantity = "",
  refresh = false,
  category = "",
): Promise<PriceSearchResponse> {
  if (!refresh) {
    const cached = getCachedPrice(name, quantity, category);
    if (cached) return cached;
  }

  const [coles, woolworths] = await Promise.all([
    searchColes(name, quantity, category),
    searchWoolworths(name, quantity, category),
  ]);

  const result: PriceSearchResponse = { query: name, coles, woolworths };
  if (coles.matches.length || woolworths.matches.length) {
    setCachedPrice(result, quantity, category);
  }
  return result;
}
