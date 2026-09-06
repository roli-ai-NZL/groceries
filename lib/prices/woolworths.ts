import { getApifyToken, searchWoolworthsViaApify } from "./apify";
import { mergeCookieJar, readSetCookieHeaders } from "./cookies";
import { rankMatches, searchQueryFor } from "./match";
import type { PricedProduct, StoreSearchResult } from "./types";
import {
  classifyParsedWoolworthsBody,
  classifyWoolworthsResponse,
  decideWoolworthsFollowUp,
  decideWoolworthsStart,
  isConnectionReset,
  isRetryableWoolworthsFailure,
  type WoolworthsFailureKind,
  woolworthsUnavailableMessage,
} from "./woolworths-errors";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.265 Safari/537.36";

const SEC_CH = {
  "sec-ch-ua": `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": `"Windows"`,
};

const WARM_URLS = [
  "https://www.woolworths.com.au/shop",
  "https://www.woolworths.com.au/shop/browse/fruit-vegetables",
];

const SEARCH_URL = "https://www.woolworths.com.au/apis/ui/Search/products";

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

export type WoolworthsDirectResult = StoreSearchResult & { kind: WoolworthsFailureKind };

type FetchFn = typeof fetch;

let cookieJar = "";
let bootstrapped = false;
let datacentreBlocked = false;
let fetchImpl: FetchFn = fetch;

export function resetWoolworthsSession() {
  cookieJar = "";
  bootstrapped = false;
  datacentreBlocked = false;
  fetchImpl = fetch;
}

export function setWoolworthsFetch(fn: FetchFn) {
  fetchImpl = fn;
}

export function isWoolworthsDatacentreBlocked() {
  return datacentreBlocked;
}

function htmlHeaders(referer?: string): HeadersInit {
  return {
    "user-agent": CHROME_UA,
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-AU,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "upgrade-insecure-requests": "1",
    ...SEC_CH,
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": referer ? "same-origin" : "none",
    "sec-fetch-user": "?1",
    ...(referer ? { referer } : {}),
    ...(cookieJar ? { cookie: cookieJar } : {}),
  };
}

function apiHeaders(query: string): HeadersInit {
  return {
    "user-agent": CHROME_UA,
    accept: "application/json, text/plain, */*",
    "accept-language": "en-AU,en;q=0.9",
    "content-type": "application/json",
    origin: "https://www.woolworths.com.au",
    referer: `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
    ...SEC_CH,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    ...(cookieJar ? { cookie: cookieJar } : {}),
  };
}

function applySetCookie(response: Response) {
  cookieJar = mergeCookieJar(cookieJar, readSetCookieHeaders(response.headers));
}

function markBlocked(kind: WoolworthsFailureKind) {
  if (kind === "blocked") datacentreBlocked = true;
}

async function warmSession(force = false) {
  if (force) {
    cookieJar = "";
    bootstrapped = false;
  }
  if (bootstrapped && cookieJar) return;

  let referer: string | undefined;
  for (const url of WARM_URLS) {
    try {
      const response = await fetchImpl(url, {
        headers: htmlHeaders(referer),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
        redirect: "follow",
      });
      applySetCookie(response);
      referer = url;
    } catch {
      // Still try the search POST — warm is best-effort.
    }
  }
  bootstrapped = true;
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

function productsFromPayload(data: { Products?: WoolworthsGroup[] }): Omit<PricedProduct, "confidence">[] {
  return (data.Products ?? [])
    .flatMap((group) => group.Products ?? [])
    .map(toProduct)
    .filter((item): item is Omit<PricedProduct, "confidence"> => Boolean(item));
}

async function searchOnce(query: string, quantity?: string, category?: string): Promise<WoolworthsDirectResult> {
  const response = await fetchImpl(SEARCH_URL, {
    method: "POST",
    headers: apiHeaders(query),
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

  const bodyText = await response.text();
  const contentType = response.headers.get("content-type");
  const kind = classifyWoolworthsResponse(response.status, bodyText, contentType);

  if (kind === "blocked") {
    return {
      store: "Woolworths",
      matches: [],
      kind,
      error: "Woolworths blocked this server (Akamai).",
    };
  }
  if (kind === "http") {
    return {
      store: "Woolworths",
      matches: [],
      kind,
      error: `Woolworths search returned ${response.status}.`,
    };
  }

  let data: { Products?: WoolworthsGroup[] };
  try {
    data = JSON.parse(bodyText) as { Products?: WoolworthsGroup[] };
  } catch {
    return { store: "Woolworths", matches: [], kind: "empty", error: "Woolworths returned an empty or unreadable search." };
  }

  const parsedKind = classifyParsedWoolworthsBody(data);
  const products = productsFromPayload(data);
  const matches = rankMatches(query, products, quantity, category);
  if (matches.length) return { store: "Woolworths", matches, kind: "ok" };
  if (parsedKind === "empty") {
    return { store: "Woolworths", matches: [], kind: "empty", error: "Woolworths returned an empty search." };
  }
  return { store: "Woolworths", matches: [], kind: "nomatch" };
}

export async function searchWoolworthsDirect(
  name: string,
  quantity?: string,
  category?: string,
): Promise<WoolworthsDirectResult> {
  const query = searchQueryFor(name, quantity, category);
  await warmSession();

  try {
    let result = await searchOnce(query, quantity, category);
    if (isRetryableWoolworthsFailure(result.kind) && !result.matches.length) {
      await warmSession(true);
      result = await searchOnce(query, quantity, category);
    }
    if (!result.matches.length && result.kind === "nomatch" && query.toLowerCase() !== name.toLowerCase()) {
      const fallback = await searchOnce(name, quantity, category);
      if (fallback.matches.length || fallback.kind !== "nomatch") result = fallback;
    }
    markBlocked(result.kind);
    return result;
  } catch (error) {
    if (isConnectionReset(error)) {
      try {
        await warmSession(true);
        return await searchOnce(query, quantity, category);
      } catch (retryError) {
        return {
          store: "Woolworths",
          matches: [],
          kind: "reset",
          error: retryError instanceof Error ? retryError.message : "Woolworths lookup failed.",
        };
      }
    }
    return {
      store: "Woolworths",
      matches: [],
      kind: "reset",
      error: error instanceof Error ? error.message : "Woolworths lookup failed.",
    };
  }
}

export async function searchWoolworths(
  name: string,
  quantity?: string,
  category?: string,
): Promise<StoreSearchResult> {
  const hasToken = Boolean(getApifyToken());
  const start = decideWoolworthsStart(datacentreBlocked, hasToken);

  if (start === "unavailable") {
    return { store: "Woolworths", matches: [], error: woolworthsUnavailableMessage(false) };
  }

  let direct: WoolworthsDirectResult | undefined;
  if (start === "direct") {
    direct = await searchWoolworthsDirect(name, quantity, category);
  }

  const followUp = decideWoolworthsFollowUp({
    alreadyBlocked: start !== "direct" || datacentreBlocked,
    hasToken,
    kind: direct?.kind,
    matchCount: direct?.matches.length ?? 0,
  });

  if (followUp === "use-matches" && direct) {
    return { store: "Woolworths", matches: direct.matches };
  }
  if (followUp === "nomatch") {
    return { store: "Woolworths", matches: [] };
  }
  if (followUp === "call-apify") {
    const apify = await searchWoolworthsViaApify(name, quantity, category, { fetch: fetchImpl });
    if (apify.matches.length) return apify;
    return { store: "Woolworths", matches: [], error: woolworthsUnavailableMessage(true) };
  }
  if (followUp === "unavailable") {
    return { store: "Woolworths", matches: [], error: woolworthsUnavailableMessage(false) };
  }
  return {
    store: "Woolworths",
    matches: [],
    error: direct?.error ?? "Woolworths lookup failed.",
  };
}
