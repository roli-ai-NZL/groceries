import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankMatches } from "./match";
import type { PricedProduct, PriceStore } from "./types";

function product(
  id: string,
  name: string,
  packSize = "500g",
  price = 8,
  store: PriceStore = "Coles",
): Omit<PricedProduct, "confidence"> {
  return {
    store,
    id,
    name,
    packSize,
    price,
    onSpecial: false,
    available: true,
  };
}

describe("rankMatches protein and cut identity", () => {
  it("ranks beef mince above cheaper pork mince for Coles and Woolworths", () => {
    for (const store of ["Coles", "Woolworths"] as const) {
      const ranked = rankMatches(
        "Beef mince",
        [
          product("pork", `${store} Pork Mince`, "500g", 5.5, store),
          product("beef", `${store} Beef Mince`, "500g", 8.4, store),
        ],
        "500g",
        "Meat",
      );
      assert.equal(ranked[0]?.id, "beef", `${store} should prefer beef mince`);
      assert.ok(
        ranked.some((item) => item.id === "pork"),
        `${store} should still offer pork mince as an alternate`,
      );
    }
  });

  it("ranks chicken breast above thigh, crumbed, and ready meals", () => {
    const ranked = rankMatches(
      "Chicken breast",
      [
        product("thigh", "Coles Chicken Thigh Fillets", "500g", 6),
        product("crumbed", "Coles Crumbed Chicken Breast Schnitzel", "500g", 7),
        product("meal", "Coles Kitchen Chicken Breast Ready Meal Made Easy", "350g", 6.5),
        product("breast", "Coles Chicken Breast Fillets", "500g", 9),
      ],
      "500g",
      "Meat",
    );
    assert.equal(ranked[0]?.id, "breast");
    assert.ok(ranked.findIndex((item) => item.id === "breast") < ranked.findIndex((item) => item.id === "thigh"));
  });

  it("ranks plain chicken breast above diced chicken breast", () => {
    const ranked = rankMatches(
      "Chicken breast",
      [
        product("diced", "Coles RSPCA Approved Chicken Breast Diced", "500g", 9),
        product("breast", "Coles Chicken Breast Fillets", "500g", 9.5),
      ],
      "500g",
      "Meat",
    );
    assert.equal(ranked[0]?.id, "breast");
  });

  it("prefers bacon over unrelated meat when both are present", () => {
    const ranked = rankMatches(
      "Bacon",
      [
        product("chicken", "Coles Chicken Breast Fillets", "500g", 9),
        product("pork", "Coles Pork Mince", "500g", 6),
        product("bacon", "Coles Middle Bacon Rashers", "400g", 8),
      ],
      undefined,
      "Meat",
    );
    assert.equal(ranked[0]?.id, "bacon");
  });

  it("still prefers the closer pack size among matching beef mince", () => {
    const ranked = rankMatches(
      "Beef mince",
      [
        product("kilo", "Coles Beef Mince", "1kg", 14),
        product("half", "Coles Beef Mince", "500g", 8),
      ],
      "500g",
      "Meat",
    );
    assert.equal(ranked[0]?.id, "half");
  });
});
