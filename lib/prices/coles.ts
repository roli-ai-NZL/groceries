import { rankMatches, searchQueryFor } from "./match";
import type { PricedProduct, StoreSearchResult } from "./types";

const BROWSER = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json, text/html;q=0.9",
  "accept-language": "en-AU,en;q=0.9",
};

const COLES_KEY = process.env.COLES_SUBSCRIPTION_KEY ?? "eae83861d1cd4de6bb9cd8a2cd6f041e";
const COLES_STORE = process.env.COLES_STORE_ID ?? "0584";

type ColesProduct = {
  _type?: string;
  id?: number | string;
  name?: string;
  brand?: string;
  size?: string;
  availability?: boolean;
  seoToken?: string | null;
  imageUris?: Array<{ uri?: string }>;
  pricing?: {
    now?: number;
    was?: number;
    comparable?: string;
    onlineSpecial?: boolean;
    unit?: { isWeighted?: boolean };
  };
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toProduct(raw: ColesProduct): Omit<PricedProduct, "confidence"> | null {
  if (!raw?.name || raw.pricing?.now == null) return null;
  const id = String(raw.id ?? "");
  if (!id) return null;
  const slug = raw.seoToken || slugify([raw.brand, raw.name, raw.size, id].filter(Boolean).join(" "));
  const imageUri = raw.imageUris?.[0]?.uri;
  return {
    store: "Coles",
    id,
    name: [raw.brand, raw.name].filter(Boolean).join(" "),
    brand: raw.brand,
    packSize: raw.size || "1 pack",
    price: raw.pricing.now,
    wasPrice: raw.pricing.was && raw.pricing.was > raw.pricing.now ? raw.pricing.was : null,
    unitPriceLabel: raw.pricing.comparable,
    onSpecial: Boolean(raw.pricing.onlineSpecial || (raw.pricing.was && raw.pricing.was > raw.pricing.now)),
    url: `https://www.coles.com.au/product/${slug}`,
    image: imageUri
      ? `https://cdn.productimages.coles.com.au/productimages${imageUri}`
      : undefined,
    available: raw.availability !== false,
    weighted: Boolean(raw.pricing.unit?.isWeighted || /approx/i.test(raw.size ?? "")),
  };
}

function rankColes(query: string, results: ColesProduct[], quantity?: string): PricedProduct[] {
  const products = results
    .filter((item) => item._type === "PRODUCT" || item.pricing)
    .map(toProduct)
    .filter((item): item is Omit<PricedProduct, "confidence"> => Boolean(item));
  return rankMatches(query, products, quantity);
}

async function searchBff(query: string, quantity?: string): Promise<PricedProduct[]> {
  const url = new URL("https://www.coles.com.au/api/bff/products/search");
  url.searchParams.set("searchTerm", query);
  url.searchParams.set("storeId", COLES_STORE);
  url.searchParams.set("start", "0");
  url.searchParams.set("sortBy", "relevance");
  url.searchParams.set("excludeAds", "true");
  url.searchParams.set("authenticated", "false");
  url.searchParams.set("subscription-key", COLES_KEY);

  const response = await fetch(url, {
    headers: BROWSER,
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Coles search returned ${response.status}`);
  }
  const data = (await response.json()) as { results?: ColesProduct[] };
  return rankColes(query, data.results ?? [], quantity);
}

async function searchHtml(query: string, quantity?: string): Promise<PricedProduct[]> {
  const url = `https://www.coles.com.au/search/products?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      ...BROWSER,
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Coles page returned ${response.status}`);
  }
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
  if (!match) throw new Error("Coles page had no product data.");
  const json = JSON.parse(match[1]) as {
    props?: { pageProps?: { searchResults?: { results?: ColesProduct[] } } };
  };
  return rankColes(query, json.props?.pageProps?.searchResults?.results ?? [], quantity);
}

export async function searchColes(name: string, quantity?: string): Promise<StoreSearchResult> {
  const query = searchQueryFor(name, quantity);
  try {
    const matches = await searchBff(query, quantity);
    return { store: "Coles", matches };
  } catch (first) {
    try {
      const matches = await searchHtml(query, quantity);
      return { store: "Coles", matches };
    } catch (second) {
      const message =
        second instanceof Error
          ? second.message
          : first instanceof Error
            ? first.message
            : "Coles lookup failed.";
      return { store: "Coles", matches: [], error: message };
    }
  }
}
