export type PriceStore = "Coles" | "Woolworths";

export type PricedProduct = {
  store: PriceStore;
  id: string;
  name: string;
  brand?: string;
  packSize: string;
  price: number | null;
  wasPrice?: number | null;
  unitPriceLabel?: string;
  onSpecial: boolean;
  url?: string;
  image?: string;
  available: boolean;
  confidence: number;
  weighted?: boolean;
};

export type StoreSearchResult = {
  store: PriceStore;
  matches: PricedProduct[];
  error?: string;
};

export type PriceSearchResponse = {
  query: string;
  coles: StoreSearchResult;
  woolworths: StoreSearchResult;
  cached?: boolean;
};

export const PRICE_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
export const PRICE_CACHE_KEY = "roland-groceries-price-cache-v1";
export const ESTIMATE_DISCLAIMER =
  "This is an estimate from public product search — not a cart. Pack sizes and substitutions can differ from what you actually buy. No login, no checkout, and prices can change.";
