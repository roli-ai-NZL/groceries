import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeRecipeIngredients, toRecipeIngredient } from "./merge";
import type { GroceryItem } from "./types";

function item(partial: Partial<GroceryItem> & Pick<GroceryItem, "name">): GroceryItem {
  return {
    id: partial.id ?? "staple-onion",
    quantity: "1",
    count: 1,
    unit: "",
    category: "Produce",
    store: "Either",
    checked: true,
    included: true,
    source: "staple",
    ...partial,
  };
}

describe("mergeRecipeIngredients", () => {
  it("adds counts when the same item is merged again", () => {
    const merged = mergeRecipeIngredients(
      [item({ name: "Onion", count: 1, quantity: "1" })],
      [toRecipeIngredient("onions", "2")],
      "Bolognese",
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].count, 3);
    assert.equal(merged[0].quantity, "3×");
    assert.equal(merged[0].checked, false);
    assert.equal(merged[0].included, true);
  });

  it("combines matching mince weights", () => {
    const merged = mergeRecipeIngredients(
      [item({ id: "mince", name: "Beef mince", quantity: "500g", count: 1, unit: "500g", category: "Meat" })],
      [toRecipeIngredient("lean minced beef", "250g")],
      "Bolognese",
    );
    assert.equal(merged[0].quantity, "750g");
    assert.equal(merged[0].count, 1);
    assert.equal(merged[0].unit, "750g");
  });

  it("appends a new recipe line when the name is new", () => {
    const merged = mergeRecipeIngredients(
      [item({ name: "Onion" })],
      [toRecipeIngredient("Parmesan", "1 wedge")],
      "Carbonara",
    );
    assert.equal(merged.length, 2);
    const added = merged.find((entry) => entry.name === "Parmesan");
    assert.ok(added);
    assert.equal(added?.count, 1);
    assert.equal(added?.unit, "wedge");
    assert.equal(added?.source, "recipe");
    assert.equal(added?.recipeName, "Carbonara");
  });
});
