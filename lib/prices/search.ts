import { searchColes } from "./coles";
import { PRICE_CACHE_TTL_MS, type PriceSearchResponse } from "./types";
import { searchWoolworths } from "./woolworths";

type CacheEntry = { expires: number; value: PriceSearchResponse };
const memory = new Map<string, CacheEntry>();

function cacheKey(name: string, quantity: string) {
  return `${name.toLowerCase().trim()}|${quantity.toLowerCase().trim()}`;
}

export function getCachedPrice(name: string, quantity: string): PriceSearchResponse | null {
  const entry = memory.get(cacheKey(name, quantity));
  if (!entry || entry.expires < Date.now()) {
    if (entry) memory.delete(cacheKey(name, quantity));
    return null;
  }
  return { ...entry.value, cached: true };
}

export function setCachedPrice(value: PriceSearchResponse, quantity: string) {
  memory.set(cacheKey(value.query, quantity), {
    expires: Date.now() + PRICE_CACHE_TTL_MS,
    value,
  });
}

export async function searchPrices(
  name: string,
  quantity = "",
  refresh = false,
): Promise<PriceSearchResponse> {
  if (!refresh) {
    const cached = getCachedPrice(name, quantity);
    if (cached) return cached;
  }

  const [coles, woolworths] = await Promise.all([
    searchColes(name, quantity),
    searchWoolworths(name, quantity),
  ]);

  const result: PriceSearchResponse = { query: name, coles, woolworths };
  if (coles.matches.length || woolworths.matches.length) {
    setCachedPrice(result, quantity);
  }
  return result;
}
