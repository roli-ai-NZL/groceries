import { searchColes } from "./coles";
import {
  PRICE_CACHE_TTL_MS,
  type PriceEstimateItemResult,
  type PriceEstimateResponse,
  type PriceSearchResponse,
} from "./types";
import { searchWoolworths, searchWoolworthsMany } from "./woolworths";

export type EstimatePriceInput = {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
};

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

function maybeCache(result: PriceSearchResponse, quantity: string, category: string) {
  const storeError = Boolean(result.coles.error || result.woolworths.error);
  if (!storeError && (result.coles.matches.length || result.woolworths.matches.length)) {
    setCachedPrice(result, quantity, category);
  }
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
  maybeCache(result, quantity, category);
  return result;
}

export async function estimatePrices(
  items: EstimatePriceInput[],
  refresh = false,
): Promise<PriceEstimateResponse> {
  const results: PriceEstimateItemResult[] = new Array(items.length);
  const pending: { index: number; item: EstimatePriceInput }[] = [];

  items.forEach((item, index) => {
    if (!refresh) {
      const cached = getCachedPrice(item.name, item.quantity ?? "", item.category ?? "");
      if (cached) {
        results[index] = { ...cached, id: item.id, query: item.name };
        return;
      }
    }
    pending.push({ index, item });
  });

  if (pending.length) {
    const [colesList, woolworthsList] = await Promise.all([
      Promise.all(pending.map(({ item }) => searchColes(item.name, item.quantity, item.category))),
      searchWoolworthsMany(pending.map(({ item }) => item)),
    ]);

    pending.forEach(({ index, item }, offset) => {
      const result: PriceEstimateItemResult = {
        id: item.id,
        query: item.name,
        coles: colesList[offset],
        woolworths: woolworthsList[offset],
      };
      maybeCache(result, item.quantity ?? "", item.category ?? "");
      results[index] = result;
    });
  }

  return { results };
}
