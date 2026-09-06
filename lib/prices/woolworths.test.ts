import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { WOOLWORTHS_APIFY_FAILED, WOOLWORTHS_UNAVAILABLE_NO_TOKEN } from "./woolworths-errors";
import { resetWoolworthsSession, searchWoolworths, setWoolworthsFetch } from "./woolworths";

const PRODUCT_JSON = JSON.stringify({
  Products: [
    {
      Products: [
        {
          Stockcode: 123,
          DisplayName: "Full Cream Milk 2L",
          Name: "Full Cream Milk 2L",
          Brand: "Woolworths",
          Price: 3.2,
          PackageSize: "2L",
          IsAvailable: true,
        },
      ],
    },
  ],
});

function jsonResponse(body: string, status = 200, extraHeaders?: HeadersInit) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function htmlDenied(status = 403) {
  return new Response("<html><h1>Access Denied</h1></html>", {
    status,
    headers: { "content-type": "text/html" },
  });
}

afterEach(() => {
  resetWoolworthsSession();
  delete process.env.APIFY_TOKEN;
});

describe("searchWoolworths direct path", () => {
  it("warms /shop then fruit-vegetables before POSTing search", async () => {
    const urls: string[] = [];
    setWoolworthsFetch(async (input, init) => {
      const url = String(input);
      urls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/apis/ui/Search/products")) {
        return jsonResponse(PRODUCT_JSON, 200, { "set-cookie": "bm_sz=warmed" });
      }
      return new Response("<html>ok</html>", {
        status: 200,
        headers: { "set-cookie": `ak_bmsc=${url.includes("fruit") ? "veg" : "shop"}` },
      });
    });

    const result = await searchWoolworths("milk", "2L", "Fridge");
    assert.ok(urls.some((url) => url.includes("GET https://www.woolworths.com.au/shop")));
    assert.ok(urls.some((url) => url.includes("/shop/browse/fruit-vegetables")));
    assert.ok(urls.some((url) => url.includes("POST https://www.woolworths.com.au/apis/ui/Search/products")));
    assert.equal(result.matches[0]?.price, 3.2);
    assert.equal(result.error, undefined);
  });

  it("retries once after re-warm on 403 and then succeeds", async () => {
    let searches = 0;
    setWoolworthsFetch(async (input) => {
      const url = String(input);
      if (url.includes("/apis/ui/Search/products")) {
        searches += 1;
        if (searches === 1) return htmlDenied(403);
        return jsonResponse(PRODUCT_JSON);
      }
      return new Response("ok", { status: 200, headers: { "set-cookie": "ak_bmsc=1" } });
    });

    const result = await searchWoolworths("milk", "2L");
    assert.equal(searches, 2);
    assert.equal(result.matches[0]?.id, "123");
  });

  it("surfaces an explicit Woolies error when blocked and there is no token", async () => {
    setWoolworthsFetch(async (input) => {
      if (String(input).includes("/apis/ui/Search/products")) return htmlDenied(403);
      return new Response("ok", { status: 200 });
    });

    const result = await searchWoolworths("milk");
    assert.equal(result.matches.length, 0);
    assert.equal(result.error, WOOLWORTHS_UNAVAILABLE_NO_TOKEN);
  });
});

describe("searchWoolworths Apify fallback", () => {
  it("calls Apify after a blocked direct search when APIFY_TOKEN is set", async () => {
    process.env.APIFY_TOKEN = "test-token";
    let apifyCalled = false;
    setWoolworthsFetch(async (input) => {
      const url = String(input);
      if (url.includes("api.apify.com")) {
        apifyCalled = true;
        return jsonResponse(
          JSON.stringify([{ productId: "55", name: "Full Cream Milk 2L", price: 2.9, unit: "2L" }]),
        );
      }
      if (url.includes("/apis/ui/Search/products")) return htmlDenied(403);
      return new Response("ok", { status: 200 });
    });

    const result = await searchWoolworths("milk", "2L", "Fridge");
    assert.equal(apifyCalled, true);
    assert.equal(result.matches[0]?.id, "55");
    assert.equal(result.matches[0]?.price, 2.9);
    assert.equal(result.error, undefined);
  });

  it("does not call Apify for a genuine empty Woolworths result", async () => {
    process.env.APIFY_TOKEN = "test-token";
    let apifyCalled = false;
    setWoolworthsFetch(async (input) => {
      const url = String(input);
      if (url.includes("api.apify.com")) {
        apifyCalled = true;
        return jsonResponse("[]");
      }
      if (url.includes("/apis/ui/Search/products")) return jsonResponse(JSON.stringify({ Products: [] }));
      return new Response("ok", { status: 200 });
    });

    const result = await searchWoolworths("zzzz-not-a-product");
    assert.equal(apifyCalled, false);
    assert.equal(result.matches.length, 0);
    assert.equal(result.error, undefined);
  });

  it("explains when Apify also fails", async () => {
    process.env.APIFY_TOKEN = "test-token";
    setWoolworthsFetch(async (input) => {
      const url = String(input);
      if (url.includes("api.apify.com")) return new Response("nope", { status: 402 });
      if (url.includes("/apis/ui/Search/products")) return htmlDenied(403);
      return new Response("ok", { status: 200 });
    });

    const result = await searchWoolworths("milk");
    assert.equal(result.matches.length, 0);
    assert.equal(result.error, WOOLWORTHS_APIFY_FAILED);
  });
});
