import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importState, normalizeGroceryItem } from "./storage";
import type { GroceryItem } from "./types";

const base = {
  id: "custom-1",
  name: "Onion",
  category: "Produce",
  store: "Either",
  checked: false,
  included: true,
  source: "custom",
} as const;

describe("normalizeGroceryItem", () => {
  it("fills count and unit from an older quantity-only row", () => {
    const migrated = normalizeGroceryItem({
      ...base,
      quantity: "x2",
    } as GroceryItem);
    assert.equal(migrated.count, 2);
    assert.equal(migrated.unit, "");
    assert.equal(migrated.quantity, "2×");
  });
});

describe("importState", () => {
  it("migrates a v1 export that only has quantity strings", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [{ ...base, quantity: "1.4kg", name: "Brisket", category: "Meat", source: "staple" }],
    });
    const items = importState(raw);
    assert.equal(items[0].count, 1);
    assert.equal(items[0].unit, "1.4kg");
    assert.equal(items[0].quantity, "1.4kg");
  });
});
