import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getCachedPrice, searchPrices } from "./search";
import { resetWoolworthsSession, setWoolworthsFetch } from "./woolworths";

afterEach(() => {
  resetWoolworthsSession();
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
});
