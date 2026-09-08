import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resetApifyClient } from "./apify";
import { estimatePrices, getCachedPrice, searchPrices } from "./search";
import { resetWoolworthsSession, setWoolworthsFetch } from "./woolworths";

afterEach(() => {
  resetWoolworthsSession();
  resetApifyClient();
  delete process.env.APIFY_TOKEN;
});

describe("searchPrices cache + Coles isolation", () => {
  it("does not cache a Coles hit when Woolworths returns a store error", async () => {
    setWoolworthsFetch(async (input) => {
      const url = String(input);
      if (url.includes("coles.com.au")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                _type: "PRODUCT",
                id: 1,
                name: "Full Cream Milk",
                brand: "Coles",
                size: "2L",
                availability: true,
                pricing: { now: 2.5 },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("woolworths.com.au/apis")) {
        return new Response("<html>Access Denied</html>", {
          status: 403,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("ok", { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("coles.com.au")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                _type: "PRODUCT",
                id: 1,
                name: "Full Cream Milk",
                brand: "Coles",
                size: "2L",
                availability: true,
                pricing: { now: 2.5 },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const result = await searchPrices("milk", "2L", true, "Fridge");
      assert.ok(result.coles.matches.length >= 0);
      assert.ok(result.woolworths.error);
      assert.match(result.woolworths.error ?? "", /Akamai/);
      assert.equal(result.coles.error, undefined);
      assert.equal(getCachedPrice("milk", "2L", "Fridge"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("prices a blocked Woolies list with a few Apify department runs", async () => {
    process.env.APIFY_TOKEN = "tok";
    let apifyStarts = 0;
    const items = [
      { id: "1", name: "Milk", quantity: "2L", category: "Fridge" },
      { id: "2", name: "Eggs", quantity: "1 dozen", category: "Fridge" },
      { id: "3", name: "Potatoes", category: "Produce" },
      { id: "4", name: "Onion", category: "Produce" },
      { id: "5", name: "Brisket", quantity: "1.4kg", category: "Meat" },
      { id: "6", name: "Bacon", category: "Meat" },
    ];

    setWoolworthsFetch(async (input) => {
      const url = String(input);
      if (url.includes("/acts/") && url.endsWith("/runs")) {
        apifyStarts += 1;
        return new Response(
          JSON.stringify({ data: { id: `run-${apifyStarts}`, status: "RUNNING", defaultDatasetId: `ds-${apifyStarts}` } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/actor-runs/")) {
        return new Response(
          JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: "ds-1" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/datasets/")) {
        return new Response(
          JSON.stringify([
            { productId: "m1", name: "Full Cream Milk 2L", price: 3, unit: "2L" },
            { productId: "e1", name: "Dozen Free Range Eggs", price: 5, unit: "12 pack" },
            { productId: "p1", name: "Washed Potatoes 1kg", price: 3, unit: "1kg" },
            { productId: "o1", name: "Brown Onion", price: 0.7, unit: "1 each" },
            { productId: "b1", name: "Beef Brisket 1.4kg", price: 18, unit: "1.4kg" },
            { productId: "ba1", name: "Middle Bacon", price: 7, unit: "200g" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/apis/ui/Search/products")) {
        return new Response("<html>Access Denied</html>", {
          status: 403,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("ok", { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("coles.com.au")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                _type: "PRODUCT",
                id: 1,
                name: "Full Cream Milk",
                brand: "Coles",
                size: "2L",
                availability: true,
                pricing: { now: 2.5 },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const { results } = await estimatePrices(items, true);
      assert.equal(results.length, 6);
      assert.ok(apifyStarts <= 3 + 8);
      assert.ok(apifyStarts < items.length);
      assert.ok(results.some((row) => row.woolworths.matches.length > 0));
      assert.ok(results.every((row) => !row.coles.error));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
