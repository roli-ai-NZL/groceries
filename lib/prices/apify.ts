import {
  CATEGORY_MAX_ITEMS,
  departmentForGroceryCategory,
  MAX_FILL_SEARCHES,
  planApifyBatchStrategy,
  SEARCH_MAX_ITEMS,
  type ApifyBatchStrategy,
} from "./apify-batch";
import {
  classifyApifyHttpStatus,
  classifyApifyRunStatus,
  classifyApifyThrown,
  formatWoolworthsApifyError,
  shortApifyBodyMessage,
  type ApifyErrorCode,
} from "./apify-errors";
import { isWeakMatch, rankMatches, searchQueryFor } from "./match";
import { PRICE_CACHE_TTL_MS, type ApifyDebugInfo, type PricedProduct, type StoreSearchResult } from "./types";
import { WOOLWORTHS_UNAVAILABLE_NO_TOKEN } from "./woolworths-errors";

export const DEFAULT_WOOLWORTHS_APIFY_ACTOR = "crawlerbros/woolworths-au-scraper";
export const APIFY_POLL_INTERVAL_MS = 1500;
export const APIFY_WAIT_BUDGET_MS = 45_000;

type EnvMap = Record<string, string | undefined>;
type FetchFn = typeof fetch;

export type WoolworthsQuery = { name: string; quantity?: string; category?: string };

type ApifyRunSuccess = { ok: true; items: unknown[] };
type ApifyRunFailure = { ok: false; error: string; code: ApifyErrorCode; status?: number };
type ApifyRunOutcome = ApifyRunSuccess | ApifyRunFailure;

type ApifyRunData = {
  id?: string;
  status?: string;
  statusMessage?: string;
  defaultDatasetId?: string;
};

type DebugState = {
  lastErrorCode?: string;
  lastErrorStatus?: number;
  runsStarted: number;
  strategy?: ApifyBatchStrategy | "search-one";
};

const resultCache = new Map<string, { expires: number; items: unknown[] }>();
const inflight = new Map<string, Promise<ApifyRunOutcome>>();
let debugState: DebugState = { runsStarted: 0 };

export function getApifyToken(env: EnvMap = process.env): string {
  return env.APIFY_TOKEN?.trim() ?? "";
}

export function getWoolworthsApifyActor(env: EnvMap = process.env): string {
  return env.APIFY_WOOLWORTHS_ACTOR?.trim() || DEFAULT_WOOLWORTHS_APIFY_ACTOR;
}

export function apifyActorPath(actorId: string): string {
  return actorId.replace("/", "~");
}

export function getApifyDebug(env: EnvMap = process.env): ApifyDebugInfo {
  return {
    tokenPresent: Boolean(getApifyToken(env)),
    actorId: getWoolworthsApifyActor(env),
    lastErrorCode: debugState.lastErrorCode,
    lastErrorStatus: debugState.lastErrorStatus,
    runsStarted: debugState.runsStarted,
    strategy: debugState.strategy,
  };
}

export function resetApifyClient() {
  resultCache.clear();
  inflight.clear();
  debugState = { runsStarted: 0 };
}

function recordApifyFailure(code: ApifyErrorCode, status?: number) {
  debugState.lastErrorCode = code;
  debugState.lastErrorStatus = status;
}

function apifyHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

export function buildWoolworthsApifyInput(
  actorId: string,
  query: string,
  options?: { mode?: "search" | "byCategory"; category?: string; maxItems?: number },
): Record<string, unknown> {
  const maxItems = options?.maxItems ?? SEARCH_MAX_ITEMS;
  if (options?.mode === "byCategory" && options.category) {
    return {
      mode: "byCategory",
      category: options.category,
      maxItems: CATEGORY_MAX_ITEMS,
      onSaleOnly: false,
    };
  }
  if (actorId.includes("crawlerbros")) {
    return {
      mode: "search",
      searchQuery: query,
      maxItems,
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
  const slug = textish(item.slug, item.UrlFriendlyName) || name.toLowerCase().replace(/[^0-9a-z]+/g, "-");
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

function unwrapRun(payload: unknown): ApifyRunData {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  return {
    id: typeof data.id === "string" ? data.id : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
    statusMessage: typeof data.statusMessage === "string" ? data.statusMessage : undefined,
    defaultDatasetId: typeof data.defaultDatasetId === "string" ? data.defaultDatasetId : undefined,
  };
}

function datasetItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown[] }).items)) {
    return (payload as { items: unknown[] }).items;
  }
  return [];
}

function failureFromHttp(status: number, body: string): ApifyRunFailure {
  const code = classifyApifyHttpStatus(status, body);
  const detail = shortApifyBodyMessage(body);
  recordApifyFailure(code, status);
  return {
    ok: false,
    code,
    status,
    error: formatWoolworthsApifyError({ code, status, detail: detail || undefined }),
  };
}

function failureFromCode(code: ApifyErrorCode, status?: number, detail?: string): ApifyRunFailure {
  recordApifyFailure(code, status);
  return {
    ok: false,
    code,
    status,
    error: formatWoolworthsApifyError({ code, status, detail }),
  };
}

async function sleep(ms: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("Apify poll timed out"), { name: "TimeoutError" }));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function startAndWaitForDataset(
  input: Record<string, unknown>,
  options: { fetch: FetchFn; env: EnvMap; budgetMs?: number },
): Promise<ApifyRunOutcome> {
  const token = getApifyToken(options.env);
  if (!token) {
    return {
      ok: false,
      code: "unauthorized",
      error: WOOLWORTHS_UNAVAILABLE_NO_TOKEN,
    };
  }

  const actor = getWoolworthsApifyActor(options.env);
  const fetchImpl = options.fetch;
  const budgetMs = options.budgetMs ?? APIFY_WAIT_BUDGET_MS;
  const deadline = Date.now() + budgetMs;
  const signal = AbortSignal.timeout(budgetMs);

  try {
    debugState.runsStarted += 1;
    const start = await fetchImpl(`https://api.apify.com/v2/acts/${apifyActorPath(actor)}/runs`, {
      method: "POST",
      headers: apifyHeaders(token),
      body: JSON.stringify(input),
      signal,
      cache: "no-store",
    });
    const startBody = await readBody(start);
    if (!start.ok) return failureFromHttp(start.status, startBody);

    let run = unwrapRun(startBody ? JSON.parse(startBody) : {});
    if (!run.id) {
      return failureFromCode("http", start.status, "Apify start returned no run id");
    }

    while (run.status !== "SUCCEEDED") {
      const terminal = run.status ? classifyApifyRunStatus(run.status) : null;
      if (terminal) {
        return failureFromCode(terminal, undefined, run.statusMessage || run.status);
      }
      if (Date.now() >= deadline) {
        return failureFromCode("timeout", undefined, "wait budget exceeded");
      }
      const poll = await fetchImpl(`https://api.apify.com/v2/actor-runs/${run.id}`, {
        headers: apifyHeaders(token),
        signal,
        cache: "no-store",
      });
      const pollBody = await readBody(poll);
      if (!poll.ok) return failureFromHttp(poll.status, pollBody);
      run = { ...run, ...unwrapRun(pollBody ? JSON.parse(pollBody) : {}) };
      if (run.status === "SUCCEEDED") break;
      const afterPoll = run.status ? classifyApifyRunStatus(run.status) : null;
      if (afterPoll) {
        return failureFromCode(afterPoll, undefined, run.statusMessage || run.status);
      }
      await sleep(APIFY_POLL_INTERVAL_MS, signal);
    }

    if (!run.defaultDatasetId) {
      return failureFromCode("empty", undefined, "run succeeded without a dataset");
    }

    const itemsResponse = await fetchImpl(
      `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?limit=200`,
      {
        headers: apifyHeaders(token),
        signal,
        cache: "no-store",
      },
    );
    const itemsBody = await readBody(itemsResponse);
    if (!itemsResponse.ok) return failureFromHttp(itemsResponse.status, itemsBody);
    const items = datasetItems(itemsBody ? JSON.parse(itemsBody) : []);
    if (!items.length) return failureFromCode("empty");
    return { ok: true, items };
  } catch (error) {
    const code = classifyApifyThrown(error);
    return failureFromCode(code, undefined, error instanceof Error ? error.message : undefined);
  }
}

async function runCached(key: string, start: () => Promise<ApifyRunOutcome>): Promise<ApifyRunOutcome> {
  const cached = resultCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return { ok: true, items: cached.items };
  }
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = start()
    .then((outcome) => {
      if (outcome.ok) {
        resultCache.set(key, { expires: Date.now() + PRICE_CACHE_TTL_MS, items: outcome.items });
      }
      return outcome;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

function queryKey(name: string, quantity?: string, category?: string) {
  return searchQueryFor(name, quantity, category).toLowerCase();
}

function resultFromOutcome(
  outcome: ApifyRunOutcome,
  name: string,
  quantity?: string,
  category?: string,
): StoreSearchResult {
  if (!outcome.ok) {
    return { store: "Woolworths", matches: [], error: outcome.error };
  }
  const query = searchQueryFor(name, quantity, category);
  let matches = mapApifyItems(outcome.items, query, quantity, category);
  if (!matches.length && query.toLowerCase() !== name.toLowerCase()) {
    matches = mapApifyItems(outcome.items, name, quantity, category);
  }
  return { store: "Woolworths", matches };
}

async function cachedSearch(
  query: string,
  options: { fetch: FetchFn; env: EnvMap },
): Promise<ApifyRunOutcome> {
  const actor = getWoolworthsApifyActor(options.env);
  const key = `search:${actor}:${query.toLowerCase()}`;
  return runCached(key, () =>
    startAndWaitForDataset(buildWoolworthsApifyInput(actor, query), options),
  );
}

async function cachedDepartment(
  department: string,
  options: { fetch: FetchFn; env: EnvMap },
): Promise<ApifyRunOutcome> {
  const actor = getWoolworthsApifyActor(options.env);
  const key = `dept:${actor}:${department}`;
  return runCached(key, () =>
    startAndWaitForDataset(buildWoolworthsApifyInput(actor, department, { mode: "byCategory", category: department }), options),
  );
}

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

  debugState.strategy = "search-one";
  const query = searchQueryFor(name, quantity, category);
  const outcome = await cachedSearch(query, { fetch: options?.fetch ?? fetch, env });
  const result = resultFromOutcome(outcome, name, quantity, category);
  if (!result.matches.length && !result.error && !outcome.ok) {
    return { store: "Woolworths", matches: [], error: outcome.error };
  }
  if (!result.matches.length && outcome.ok) {
    return { store: "Woolworths", matches: [] };
  }
  return result;
}

function firstFailure(outcomes: ApifyRunOutcome[]): ApifyRunFailure | undefined {
  return outcomes.find((outcome): outcome is ApifyRunFailure => !outcome.ok);
}

export async function searchWoolworthsViaApifyBatch(
  items: WoolworthsQuery[],
  options?: { fetch?: FetchFn; env?: EnvMap },
): Promise<StoreSearchResult[]> {
  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetch ?? fetch;
  const ctx = { fetch: fetchImpl, env };

  if (!items.length) return [];
  if (!getApifyToken(env)) {
    return items.map(() => ({ store: "Woolworths", matches: [], error: WOOLWORTHS_UNAVAILABLE_NO_TOKEN }));
  }

  const uniqueQueries = [...new Set(items.map((item) => queryKey(item.name, item.quantity, item.category)))];
  const actor = getWoolworthsApifyActor(env);
  const strategy =
    actor.includes("crawlerbros") ? planApifyBatchStrategy(uniqueQueries.length) : "search";
  debugState.strategy = strategy;

  if (strategy === "search") {
    const byQuery = new Map<string, ApifyRunOutcome>();
    await Promise.all(
      uniqueQueries.map(async (query) => {
        byQuery.set(query, await cachedSearch(query, ctx));
      }),
    );
    const failed = [...byQuery.values()].filter((outcome) => !outcome.ok);
    if (failed.length === byQuery.size) {
      const error = firstFailure(failed)?.error;
      return items.map(() => ({ store: "Woolworths", matches: [], error }));
    }
    return items.map((item) => {
      const outcome = byQuery.get(queryKey(item.name, item.quantity, item.category));
      return outcome
        ? resultFromOutcome(outcome, item.name, item.quantity, item.category)
        : { store: "Woolworths", matches: [] };
    });
  }

  const departments = [
    ...new Set(items.map((item) => departmentForGroceryCategory(item.category ?? ""))),
  ];
  const byDepartment = new Map<string, ApifyRunOutcome>();
  await Promise.all(
    departments.map(async (department) => {
      byDepartment.set(department, await cachedDepartment(department, ctx));
    }),
  );

  const deptOutcomes = [...byDepartment.values()];
  if (deptOutcomes.length && deptOutcomes.every((outcome) => !outcome.ok)) {
    const error = firstFailure(deptOutcomes)?.error;
    return items.map(() => ({ store: "Woolworths", matches: [], error }));
  }

  const results = items.map((item) => {
    const department = departmentForGroceryCategory(item.category ?? "");
    const own = byDepartment.get(department);
    const pooled = deptOutcomes.flatMap((outcome) => (outcome.ok ? outcome.items : []));
    const outcome: ApifyRunOutcome = own?.ok ? own : { ok: true, items: pooled };
    return resultFromOutcome(outcome, item.name, item.quantity, item.category);
  });

  const fillNeeded: { index: number; query: string }[] = [];
  const seenFill = new Set<string>();
  results.forEach((result, index) => {
    if (result.error) return;
    const top = result.matches[0];
    if (top && !isWeakMatch(top)) return;
    const item = items[index];
    const query = queryKey(item.name, item.quantity, item.category);
    if (seenFill.has(query) || fillNeeded.length >= MAX_FILL_SEARCHES) return;
    seenFill.add(query);
    fillNeeded.push({ index, query: searchQueryFor(item.name, item.quantity, item.category) });
  });

  if (fillNeeded.length) {
    const fillOutcomes = new Map<string, ApifyRunOutcome>();
    await Promise.all(
      fillNeeded.map(async ({ query }) => {
        fillOutcomes.set(query.toLowerCase(), await cachedSearch(query, ctx));
      }),
    );
    for (const { index, query } of fillNeeded) {
      const item = items[index];
      const filled = resultFromOutcome(
        fillOutcomes.get(query.toLowerCase()) ?? { ok: true, items: [] },
        item.name,
        item.quantity,
        item.category,
      );
      if (filled.matches.length) results[index] = filled;
      else if (filled.error && !results[index].matches.length) results[index] = filled;
    }
  }

  return results;
}
