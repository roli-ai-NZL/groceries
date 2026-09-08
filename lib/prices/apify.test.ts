import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apifyActorPath,
  buildWoolworthsApifyInput,
  DEFAULT_WOOLWORTHS_APIFY_ACTOR,
  getApifyToken,
  mapApifyItems,
  mapApifyProduct,
  searchWoolworthsViaApify,
} from "./apify";
import { WOOLWORTHS_UNAVAILABLE_NO_TOKEN } from "./woolworths-errors";

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

  it("posts the crawlerbros search schema and maps dataset items", async () => {
    let url = "";
    let body = "";
    const result = await searchWoolworthsViaApify("milk", "2L", "Fridge", {
      env: { APIFY_TOKEN: "tok" },
      fetch: async (input, init) => {
        url = String(input);
        body = String(init?.body ?? "");
        return new Response(
          JSON.stringify([{ productId: "9", name: "Full Cream Milk 2L", price: 3, unit: "2L" }]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    assert.match(url, /crawlerbros~woolworths-au-scraper\/run-sync-get-dataset-items/);
    assert.deepEqual(JSON.parse(body), {
      mode: "search",
      searchQuery: "full cream milk 2L",
      maxItems: 12,
      onSaleOnly: false,
    });
    assert.equal(result.matches[0]?.price, 3);
    assert.equal(result.error, undefined);
  });
});
