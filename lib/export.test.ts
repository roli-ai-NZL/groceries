import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildShoppingPayload, formatShoppingList } from "./export";
import type { GroceryItem } from "./types";

const onion: GroceryItem = {
  id: "onion",
  name: "Onion",
  quantity: "5×",
  count: 5,
  unit: "",
  category: "Produce",
  store: "Either",
  checked: false,
  included: true,
  source: "staple",
};

const brisket: GroceryItem = {
  id: "brisket",
  name: "Brisket",
  quantity: "2× 1.4kg",
  count: 2,
  unit: "1.4kg",
  category: "Meat",
  store: "Coles",
  checked: false,
  included: true,
  source: "staple",
};

describe("buildShoppingPayload", () => {
  it("exports count, unit, and a display quantity that includes the count", () => {
    const payload = buildShoppingPayload([onion, brisket]);
    assert.equal(payload.itemCount, 2);
    assert.deepEqual(
      payload.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        count: item.count,
        unit: item.unit,
      })),
      [
        { name: "Onion", quantity: "5×", count: 5, unit: undefined },
        { name: "Brisket", quantity: "2× 1.4kg", count: 2, unit: "1.4kg" },
      ],
    );
    const list = formatShoppingList(payload);
    assert.match(list, /Onion — 5×/);
    assert.match(list, /Brisket — 2× 1\.4kg/);
  });
});
