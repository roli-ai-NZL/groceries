import { rankMatches, searchQueryFor } from "./match";
import type { PricedProduct, StoreSearchResult } from "./types";

const BROWSER = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-AU,en;q=0.9",
  origin: "https://www.woolworths.com.au",
};

type WoolworthsProduct = {
  Stockcode?: number;
  Name?: string;
  DisplayName?: string;
  Brand?: string;
  Price?: number | null;
  InstorePrice?: number | null;
  WasPrice?: number | null;
  PackageSize?: string;
  CupString?: string;
  IsOnSpecial?: boolean;
  IsHalfPrice?: boolean;
  IsAvailable?: boolean;
  UrlFriendlyName?: string;
  MediumImageFile?: string;
  SmallImageFile?: string;
  Unit?: string;
};

type WoolworthsGroup = {
  Products?: WoolworthsProduct[];
  Name?: string;
};

let cookieJar = "";
let bootstrapped = false;

function applySetCookie(response: Response) {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const cookies = getSetCookie ? getSetCookie() : [];
  if (!cookies.length) {
    const single = response.headers.get("set-cookie");
    if (single) cookies.push(single);
  }
  const next = cookies
    .map((entry) => entry.split(";")[0])
    .filter(Boolean);
  if (next.length) {
    const merged = new Map(
      `${cookieJar};${next.join(";")}`
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const idx = part.indexOf("=");
          return [part.slice(0, idx), part] as const;
        }),
    );
    cookieJar = [...merged.values()].join("; ");
  }
}

async function bootstrap() {
  if (bootstrapped && cookieJar) return;
  try {
    const response = await fetch("https://www.woolworths.com.au/", {
      headers: {
        ...BROWSER,
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      redirect: "follow",
    });
    applySetCookie(response);
    bootstrapped = true;
  } catch {
    bootstrapped = true;
  }
}

function toProduct(raw: WoolworthsProduct): Omit<PricedProduct, "confidence"> | null {
  const price = raw.Price ?? raw.InstorePrice ?? null;
  const id = raw.Stockcode != null ? String(raw.Stockcode) : "";
  const name = raw.DisplayName || raw.Name;
  if (!id || !name || price == null) return null;
  const slug = raw.UrlFriendlyName || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    store: "Woolworths",
    id,
    name,
    brand: raw.Brand,
    packSize: raw.PackageSize || raw.Unit || "1 pack",
    price,
    wasPrice: raw.WasPrice && raw.WasPrice > price ? raw.WasPrice : null,
    unitPriceLabel: raw.CupString,
    onSpecial: Boolean(raw.IsOnSpecial || raw.IsHalfPrice),
    url: `https://www.woolworths.com.au/shop/productdetails/${id}/${slug}`,
    image: raw.MediumImageFile || raw.SmallImageFile,
    available: raw.IsAvailable !== false,
    weighted: /kg|approx/i.test(raw.PackageSize ?? "") && /each|kg/i.test(raw.Unit ?? raw.PackageSize ?? ""),
  };
}

async function searchOnce(query: string, quantity?: string, category?: string): Promise<StoreSearchResult> {
  const response = await fetch("https://www.woolworths.com.au/apis/ui/Search/products", {
    method: "POST",
    headers: {
      ...BROWSER,
      "content-type": "application/json",
      referer: `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
      ...(cookieJar ? { cookie: cookieJar } : {}),
    },
    body: JSON.stringify({
      Filters: [],
      IsSpecial: false,
      Location: `/shop/search/products?searchTerm=${query}`,
      PageNumber: 1,
      PageSize: 24,
      SearchTerm: query,
      SortType: "TraderRelevance",
      IsHideEverydayMarketProducts: false,
      IsRegisteredRewardCardPromotion: null,
      ExcludeSearchTypes: ["UntraceableVendors"],
      GpBoost: 0,
      GroupEdmVariants: false,
      EnableAdReRanking: false,
    }),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  applySetCookie(response);

  if (response.status === 403) {
    return {
      store: "Woolworths",
      matches: [],
      error:
        "Woolworths blocked this server (Akamai). Try Estimate bill from a home / Australian network — same search their site uses.",
    };
  }
  if (!response.ok) {
    return {
      store: "Woolworths",
      matches: [],
      error: `Woolworths search returned ${response.status}.`,
    };
  }

  const data = (await response.json()) as { Products?: WoolworthsGroup[] };
  const products = (data.Products ?? [])
    .flatMap((group) => group.Products ?? [])
    .map(toProduct)
    .filter((item): item is Omit<PricedProduct, "confidence"> => Boolean(item));

  return { store: "Woolworths", matches: rankMatches(query, products, quantity, category) };
}

export async function searchWoolworths(name: string, quantity?: string, category?: string): Promise<StoreSearchResult> {
  const query = searchQueryFor(name, quantity, category);
  await bootstrap();

  try {
    let result = await searchOnce(query, quantity, category);
    if (!result.matches.length && !result.error && query.toLowerCase() !== name.toLowerCase()) {
      result = await searchOnce(name, quantity, category);
    }
    return result;
  } catch (error) {
    return {
      store: "Woolworths",
      matches: [],
      error: error instanceof Error ? error.message : "Woolworths lookup failed.",
    };
  }
}
