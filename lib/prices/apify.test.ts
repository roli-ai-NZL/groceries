import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  apifyActorPath,
  buildWoolworthsApifyInput,
  DEFAULT_WOOLWORTHS_APIFY_ACTOR,
  getApifyDebug,
  getApifyToken,
  mapApifyItems,
  mapApifyProduct,
  resetApifyClient,
  searchWoolworthsViaApify,
  searchWoolworthsViaApifyBatch,
} from "./apify";
import { WOOLWORTHS_UNAVAILABLE_NO_TOKEN } from "./woolworths-errors";

afterEach(() => {
  resetApifyClient();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function apifyMock(options?: {
  startStatus?: number;
  startBody?: unknown;
  runStatus?: string;
  itemsFor?: (input: Record<string, unknown>) => unknown[];
  items?: unknown[];
}) {
  const started: Record<string, unknown>[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/acts/") && url.endsWith("/runs") && (init?.method ?? "GET") === "POST") {
      if (options?.startStatus && options.startStatus >= 400) {
        return json(options.startBody ?? { error: { message: "nope" } }, options.startStatus);
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      started.push(body);
      return json({
        data: { id: `run-${started.length}`, status: "RUNNING", defaultDatasetId: `ds-${started.length}` },
      });
    }
    if (url.includes("/actor-runs/")) {
      const id = url.split("/actor-runs/")[1] ?? "";
      const index = Number(id.replace("run-", "")) || 1;
      return json({
        data: {
          id,
          status: options?.runStatus ?? "SUCCEEDED",
          defaultDatasetId: `ds-${index}`,
        },
      });
    }
    if (url.includes("/datasets/")) {
      const id = url.split("/datasets/")[1]?.split("/")[0] ?? "";
      const index = Number(id.replace("ds-", "")) || 1;
      const input = started[index - 1] ?? {};
      const items = options?.itemsFor?.(input) ?? options?.items ?? [];
      return json(items);
    }
    return new Response("not found", { status: 404 });
  };
  return { fetchImpl, started };
}

describe("Apify Woolworths actor helpers", () => {
  it("uses the verified crawlerbros actor by default", () => {
    assert.equal(DEFAULT_WOOLWORTHS_APIFY_ACTOR, "crawlerbros/woolworths-au-scraper");
    assert.equal(apifyActorPath(DEFAULT_WOOLWORTHS_APIFY_ACTOR), "crawlerbros~woolworths-au-scraper");
    assert.deepEqual(buildWoolworthsApifyInput(DEFAULT_WOOLWORTHS_APIFY_ACTOR, "full cream milk"), {
      mode: "search",
      searchQuery: "full cream milk",
      maxItems: 12,
      onSaleOnly: false,
    });
  });

  it("builds the dromb search input when that actor is configured", () => {
    assert.deepEqual(
      buildWoolworthsApifyInput("dromb/woolworths-au-product-search-catalog-unofficial", "eggs"),
      { operation: "search", query: "eggs", page: 1, includeRaw: false },
    );
  });

  it("reads APIFY_TOKEN from env", () => {
    assert.equal(getApifyToken({}), "");
    assert.equal(getApifyToken({ APIFY_TOKEN: "  abc  " }), "abc");
  });
});

describe("mapApifyProduct", () => {
  it("maps crawlerbros records into PricedProduct", () => {
    const product = mapApifyProduct({
      productId: "123",
      name: "Woolworths Full Cream Milk 2L",
      brand: "Woolworths",
      unit: "2L",
      price: 3.2,
      originalPrice: 4.0,
      pricePerUnit: "$1.60 / 1L",
      productUrl: "https://www.woolworths.com.au/shop/productdetails/123/milk",
      imageUrl: "https://cdn.example/milk.jpg",
      isOnSale: true,
      inStock: true,
    });
    assert.ok(product);
    assert.equal(product.store, "Woolworths");
    assert.equal(product.id, "123");
    assert.equal(product.price, 3.2);
    assert.equal(product.wasPrice, 4);
    assert.equal(product.onSpecial, true);
    assert.equal(product.packSize, "2L");
  });

  it("maps dromb records (discount_price is the current special)", () => {
    const product = mapApifyProduct({
      id: "888140",
      name: "Dairy Farmers Milk",
      brand: "Dairy Farmers",
      size: "2L",
      price: 4.5,
      discount_price: 3.8,
      unit_price: "$1.90 / 1L",
      source_url: "https://www.woolworths.com.au/shop/productdetails/888140/milk",
      is_available: true,
    });
    assert.ok(product);
    assert.equal(product.price, 3.8);
    assert.equal(product.wasPrice, 4.5);
    assert.equal(product.onSpecial, true);
  });

  it("ranks mapped items with the shared matcher", () => {
    const matches = mapApifyItems(
      [
        { productId: "1", name: "Full Cream Milk 2L", price: 3.1, unit: "2L" },
        { productId: "2", name: "Chocolate biscuits", price: 4, unit: "200g" },
      ],
      "full cream milk",
      "2L",
      "Fridge",
    );
    assert.equal(matches[0]?.id, "1");
    assert.ok((matches[0]?.confidence ?? 0) > 0.5);
  });
});

describe("searchWoolworthsViaApify", () => {
  it("does not call Apify without a token", async () => {
    let called = false;
    const result = await searchWoolworthsViaApify("milk", "2L", "Fridge", {
      env: {},
      fetch: async () => {
        called = true;
        return new Response("[]");
      },
    });
    assert.equal(called, false);
    assert.equal(result.error, WOOLWORTHS_UNAVAILABLE_NO_TOKEN);
    assert.equal(result.matches.length, 0);
  });

  it("starts an async run, polls, and maps dataset items", async () => {
    const { fetchImpl, started } = apifyMock({
      items: [{ productId: "9", name: "Full Cream Milk 2L", price: 3, unit: "2L" }],
    });
    const result = await searchWoolworthsViaApify("milk", "2L", "Fridge", {
      env: { APIFY_TOKEN: "tok" },
      fetch: fetchImpl,
    });
    assert.equal(started.length, 1);
    assert.deepEqual(started[0], {
      mode: "search",
      searchQuery: "full cream milk 2L",
      maxItems: 12,
      onSaleOnly: false,
    });
    assert.equal(result.matches[0]?.price, 3);
    assert.equal(result.error, undefined);
  });

  it("shares one actor run across identical concurrent lookups", async () => {
    const { fetchImpl, started } = apifyMock({
      items: [{ productId: "9", name: "Full Cream Milk 2L", price: 3, unit: "2L" }],
    });
    const env = { APIFY_TOKEN: "tok" };
    const [a, b] = await Promise.all([
      searchWoolworthsViaApify("milk", "2L", "Fridge", { env, fetch: fetchImpl }),
      searchWoolworthsViaApify("milk", "2L", "Fridge", { env, fetch: fetchImpl }),
    ]);
    assert.equal(started.length, 1);
    assert.equal(a.matches[0]?.id, "9");
    assert.equal(b.matches[0]?.id, "9");
    assert.equal(getApifyDebug(env).runsStarted, 1);
    assert.equal(getApifyDebug(env).tokenPresent, true);
    assert.equal(getApifyDebug(env).actorId, DEFAULT_WOOLWORTHS_APIFY_ACTOR);
  });

  it("surfaces HTTP status and a short Apify reason", async () => {
    const { fetchImpl } = apifyMock({
      startStatus: 401,
      startBody: { error: { message: "Token is invalid" } },
    });
    const result = await searchWoolworthsViaApify("milk", "", "", {
      env: { APIFY_TOKEN: "bad" },
      fetch: fetchImpl,
    });
    assert.match(result.error ?? "", /401 unauthorized/);
    assert.match(result.error ?? "", /Token is invalid/);
    assert.equal(getApifyDebug({ APIFY_TOKEN: "bad" }).lastErrorCode, "unauthorized");
    assert.equal(getApifyDebug({ APIFY_TOKEN: "bad" }).lastErrorStatus, 401);
    assert.equal(getApifyDebug({}).tokenPresent, false);
  });
});

describe("searchWoolworthsViaApifyBatch", () => {
  it("does not start one run per grocery line on a full list", async () => {
    const items = [
      { name: "Milk", quantity: "2L", category: "Fridge" },
      { name: "Eggs", quantity: "1 dozen", category: "Fridge" },
      { name: "Sour cream", category: "Fridge" },
      { name: "Potatoes", category: "Produce" },
      { name: "Onion", category: "Produce" },
      { name: "Carrot", category: "Produce" },
      { name: "Brisket", quantity: "1.4kg", category: "Meat" },
      { name: "Bacon", category: "Meat" },
    ];
    const { fetchImpl, started } = apifyMock({
      itemsFor: (input) => {
        if (input.mode === "byCategory" && input.category === "1_6E4F4E4") {
          return [
            { productId: "m1", name: "Full Cream Milk 2L", price: 3, unit: "2L" },
            { productId: "e1", name: "Dozen Free Range Eggs", price: 5, unit: "12 pack" },
            { productId: "s1", name: "Sour Cream 250g", price: 2.5, unit: "250g" },
          ];
        }
        if (input.mode === "byCategory" && input.category === "1_D5A2236") {
          return [
            { productId: "p1", name: "Washed Potatoes 1kg", price: 3, unit: "1kg" },
            { productId: "o1", name: "Brown Onion", price: 0.7, unit: "1 each" },
            { productId: "c1", name: "Carrot", price: 0.6, unit: "1 each" },
          ];
        }
        if (input.mode === "byCategory" && input.category === "1_ACA2FC2") {
          return [
            { productId: "b1", name: "Beef Brisket 1.4kg", price: 18, unit: "1.4kg" },
            { productId: "ba1", name: "Middle Bacon", price: 7, unit: "200g" },
          ];
        }
        return [{ productId: "x", name: "Other", price: 1, unit: "1" }];
      },
    });

    const results = await searchWoolworthsViaApifyBatch(items, {
      env: { APIFY_TOKEN: "tok" },
      fetch: fetchImpl,
    });

    assert.ok(started.length <= 3 + 8);
    assert.ok(started.every((input) => input.mode === "byCategory"));
    assert.equal(new Set(started.map((input) => input.category)).size, 3);
    assert.ok(results.every((result) => result.matches.length > 0));
    assert.equal(getApifyDebug({ APIFY_TOKEN: "tok" }).strategy, "departments-then-fill");
    assert.ok((getApifyDebug({ APIFY_TOKEN: "tok" }).runsStarted ?? 99) <= 3);
  });
});
