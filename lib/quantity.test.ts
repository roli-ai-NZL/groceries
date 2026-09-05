import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyQuantityPatch,
  combineItemQuantities,
  effectiveQuantity,
  formatDisplayQuantity,
  itemSearchQuantity,
  parseQuantity,
  quantityFieldsFrom,
  splitQuantity,
} from "./quantity";

describe("splitQuantity", () => {
  it("reads bare counts and x-prefix counts", () => {
    assert.deepEqual(splitQuantity("x2"), { count: 2, unit: "" });
    assert.deepEqual(splitQuantity("2"), { count: 2, unit: "" });
    assert.deepEqual(splitQuantity("2×"), { count: 2, unit: "" });
    assert.deepEqual(splitQuantity("5x"), { count: 5, unit: "" });
  });

  it("keeps pack sizes as the unit with count 1", () => {
    assert.deepEqual(splitQuantity("1.4kg"), { count: 1, unit: "1.4kg" });
    assert.deepEqual(splitQuantity("~600g"), { count: 1, unit: "~600g" });
    assert.deepEqual(splitQuantity("2L"), { count: 1, unit: "2L" });
    assert.deepEqual(splitQuantity("500g"), { count: 1, unit: "500g" });
  });

  it("splits integer + countable unit", () => {
    assert.deepEqual(splitQuantity("1 punnet"), { count: 1, unit: "punnet" });
    assert.deepEqual(splitQuantity("1 bunch"), { count: 1, unit: "bunch" });
    assert.deepEqual(splitQuantity("2 tbsp"), { count: 2, unit: "tbsp" });
  });

  it("reads count × pack size", () => {
    assert.deepEqual(splitQuantity("2× 1.4kg"), { count: 2, unit: "1.4kg" });
    assert.deepEqual(splitQuantity("2 x 1.4kg"), { count: 2, unit: "1.4kg" });
  });

  it("leaves odd strings in the unit", () => {
    assert.deepEqual(splitQuantity("a handful"), { count: 1, unit: "a handful" });
    assert.deepEqual(splitQuantity("x2 + 1.4kg"), { count: 1, unit: "x2 + 1.4kg" });
  });
});

describe("formatDisplayQuantity", () => {
  it("shows a prominent count for items without a unit", () => {
    assert.equal(formatDisplayQuantity(1, ""), "1");
    assert.equal(formatDisplayQuantity(5, ""), "5×");
  });

  it("keeps pack sizes readable when the count changes", () => {
    assert.equal(formatDisplayQuantity(1, "1.4kg"), "1.4kg");
    assert.equal(formatDisplayQuantity(2, "1.4kg"), "2× 1.4kg");
    assert.equal(formatDisplayQuantity(1, "punnet"), "1 punnet");
    assert.equal(formatDisplayQuantity(2, "punnet"), "2 punnet");
    assert.equal(formatDisplayQuantity(2, "kg"), "2kg");
  });
});

describe("effectiveQuantity", () => {
  it("multiplies count by a measurable pack size", () => {
    assert.equal(effectiveQuantity(2, "1.4kg"), "2.8kg");
    assert.equal(effectiveQuantity(2, "~600g"), "~1200g");
    assert.equal(effectiveQuantity(5, ""), "x5");
    assert.equal(effectiveQuantity(2, "punnet"), "2 punnet");
  });
});

describe("parseQuantity", () => {
  it("understands count × pack size for estimates", () => {
    assert.deepEqual(parseQuantity("2× 1.4kg"), { value: 2.8, unit: "kg", approx: false });
    assert.deepEqual(parseQuantity("5×"), { value: 5, unit: "item", approx: false });
  });
});

describe("quantityFieldsFrom", () => {
  it("migrates older free-text quantities", () => {
    assert.deepEqual(quantityFieldsFrom({ quantity: "x2" }), {
      count: 2,
      unit: "",
      quantity: "2×",
    });
    assert.deepEqual(quantityFieldsFrom({ quantity: "1.4kg" }), {
      count: 1,
      unit: "1.4kg",
      quantity: "1.4kg",
    });
    assert.deepEqual(quantityFieldsFrom({ quantity: "~600g" }), {
      count: 1,
      unit: "~600g",
      quantity: "~600g",
    });
  });

  it("prefers an explicit count already on the item", () => {
    assert.deepEqual(quantityFieldsFrom({ quantity: "1.4kg", count: 3, unit: "1.4kg" }), {
      count: 3,
      unit: "1.4kg",
      quantity: "3× 1.4kg",
    });
  });
});

describe("applyQuantityPatch", () => {
  it("keeps quantity in sync when the stepper changes", () => {
    const next = applyQuantityPatch({ name: "Onion", count: 1, unit: "", quantity: "1" }, { count: 5 });
    assert.equal(next.count, 5);
    assert.equal(next.quantity, "5×");
    assert.equal(itemSearchQuantity(next), "x5");
  });

  it("does not clobber name or checked when only count changes", () => {
    const next = applyQuantityPatch(
      { name: "Onion", checked: true, count: 1, unit: "", quantity: "1" },
      { count: 2 },
    );
    assert.equal(next.name, "Onion");
    assert.equal(next.checked, true);
    assert.equal(next.count, 2);
  });
});

describe("combineItemQuantities", () => {
  it("adds counts when names share a unit", () => {
    assert.deepEqual(
      combineItemQuantities({ count: 2, unit: "", quantity: "2×" }, { count: 1, unit: "", quantity: "1" }),
      { count: 3, unit: "", quantity: "3×" },
    );
    assert.deepEqual(
      combineItemQuantities({ quantity: "1 punnet" }, { quantity: "2 punnet" }),
      { count: 3, unit: "punnet", quantity: "3 punnet" },
    );
  });

  it("combines compatible weights into one pack size", () => {
    const merged = combineItemQuantities({ quantity: "500g" }, { quantity: "250g" });
    assert.equal(merged.count, 1);
    assert.equal(merged.unit, "750g");
    assert.equal(merged.quantity, "750g");
  });
});
