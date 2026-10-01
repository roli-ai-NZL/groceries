import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { priceCacheKey, readClientPriceCache } from "./clientCache";
import type { GroceryItem } from "../types";

const onion: GroceryItem = {
  id: "onion",
  name: "Onion",
  quantity: "5×",
  count: 5,
  unit: "",
  category: "Produce",
  store: "Either",
  checked: true,
  included: true,
  source: "staple",
};

describe("priceCacheKey", () => {
  it("matches Estimate’s name|qty|category key", () => {
    assert.equal(priceCacheKey(onion), "onion|x5|Produce");
  });
});

describe("readClientPriceCache", () => {
  it("returns empty when window is missing (node tests)", () => {
    assert.deepEqual(readClientPriceCache(), {});
  });
});
