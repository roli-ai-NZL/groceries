import { itemSearchQuantity } from "../quantity";
import type { GroceryItem } from "../types";
import { PRICE_CACHE_KEY, type PriceSearchResponse } from "./types";

export type ClientPriceCache = Record<string, { fetchedAt: number; payload: PriceSearchResponse }>;

export function priceCacheKey(item: GroceryItem) {
  return `${item.name.toLowerCase()}|${itemSearchQuantity(item).toLowerCase()}|${item.category}`;
}

export function readClientPriceCache(): ClientPriceCache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PRICE_CACHE_KEY) ?? "{}") as ClientPriceCache;
  } catch {
    return {};
  }
}

export function writeClientPriceCache(cache: ClientPriceCache) {
  window.localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
}
