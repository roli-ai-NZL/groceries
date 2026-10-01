import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_HANDOFF_LINE,
  AGENT_INSTRUCTIONS,
  buildShoppingPayload,
  estimateItems,
  formatAgentBrief,
  formatShoppingList,
  shoppingItems,
  storeCartCounts,
} from "./export";
import type { ClientPriceCache } from "./prices/clientCache";
import { priceCacheKey } from "./prices/clientCache";
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

const milk: GroceryItem = {
  id: "milk",
  name: "Milk",
  quantity: "2×",
  count: 2,
  unit: "",
  category: "Fridge",
  store: "Woolworths",
  checked: false,
  included: true,
  source: "staple",
};

describe("estimateItems", () => {
  it("prices only checked rows", () => {
    const checkedOnion = { ...onion, checked: true };
    const ready = estimateItems([checkedOnion, brisket, { ...brisket, id: "skip", included: false }]);
    assert.deepEqual(
      ready.map((item) => item.id),
      ["onion"],
    );
  });

  it("returns nothing when no rows are checked", () => {
    assert.deepEqual(estimateItems([onion, brisket]), []);
  });
});

describe("shoppingItems", () => {
  it("uses the same checked-only selection as Estimate", () => {
    const checkedOnion = { ...onion, checked: true };
    const checkedMilk = { ...milk, checked: true };
    assert.deepEqual(
      shoppingItems([checkedOnion, brisket, checkedMilk]).map((item) => item.id),
      ["onion", "milk"],
    );
    assert.deepEqual(shoppingItems([onion, brisket]), []);
    assert.deepEqual(
      shoppingItems([{ ...onion, checked: true }, brisket]).map((item) => item.id),
      estimateItems([{ ...onion, checked: true }, brisket]).map((item) => item.id),
    );
  });
});

describe("buildShoppingPayload", () => {
  it("exports count, unit, and a display quantity that includes the count", () => {
    const payload = buildShoppingPayload([
      { ...onion, checked: true },
      { ...brisket, checked: true },
    ]);
    assert.equal(payload.itemCount, 2);
    assert.equal(payload.timezone, "Australia/Sydney");
    assert.equal(payload.shopper, "Roland");
    assert.equal(payload.instructions, AGENT_INSTRUCTIONS);
    assert.match(payload.instructions, /trolley only/i);
    assert.match(payload.instructions, /checkout/i);
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
    assert.match(list, new RegExp(AGENT_HANDOFF_LINE));
  });

  it("omits unchecked rows even when they are included this week", () => {
    const payload = buildShoppingPayload([onion, { ...brisket, checked: true }]);
    assert.equal(payload.itemCount, 1);
    assert.equal(payload.items[0]?.name, "Brisket");
  });

  it("always buckets by Coles, Woolworths, and Either", () => {
    const payload = buildShoppingPayload([
      { ...onion, checked: true },
      { ...brisket, checked: true },
      { ...milk, checked: true },
    ]);
    assert.deepEqual(
      payload.byStore.Coles.map((item) => item.name),
      ["Brisket"],
    );
    assert.deepEqual(
      payload.byStore.Woolworths.map((item) => item.name),
      ["Milk"],
    );
    assert.deepEqual(
      payload.byStore.Either.map((item) => item.name),
      ["Onion"],
    );
    const counts = storeCartCounts(payload);
    assert.equal(counts.coles, 1);
    assert.equal(counts.woolworths, 1);
    assert.equal(counts.either, 1);
    assert.equal(counts.colesCart, 2);
    assert.equal(counts.woolworthsCart, 2);
  });

  it("keeps empty store buckets when nothing is assigned there", () => {
    const payload = buildShoppingPayload([{ ...brisket, checked: true }]);
    assert.deepEqual(payload.byStore.Woolworths, []);
    assert.deepEqual(payload.byStore.Either, []);
    assert.equal(payload.byStore.Coles.length, 1);
  });

  it("attaches last-Estimate product id/url when a cache entry exists", () => {
    const item = { ...brisket, checked: true };
    const cache: ClientPriceCache = {
      [priceCacheKey(item)]: {
        fetchedAt: Date.now(),
        payload: {
          query: "Brisket",
          coles: {
            store: "Coles",
            matches: [
              {
                store: "Coles",
                id: "coles-brisket",
                name: "Coles Beef Brisket",
                packSize: "1.4kg",
                price: 24,
                onSpecial: false,
                available: true,
                confidence: 0.9,
                url: "https://www.coles.com.au/brisket",
              },
            ],
          },
          woolworths: { store: "Woolworths", matches: [] },
        },
      },
    };
    const payload = buildShoppingPayload([item, onion], { estimateCache: cache });
    assert.equal(payload.itemCount, 1);
    assert.deepEqual(payload.items[0]?.matched, {
      coles: {
        id: "coles-brisket",
        name: "Coles Beef Brisket",
        url: "https://www.coles.com.au/brisket",
        packSize: "1.4kg",
      },
    });
    assert.ok(payload.items[0]?.matched && !("woolworths" in payload.items[0].matched));
  });

  it("omits matched when the estimate cache has no hit", () => {
    const payload = buildShoppingPayload([{ ...onion, checked: true }], { estimateCache: {} });
    assert.equal(payload.items[0]?.matched, undefined);
  });
});

describe("formatAgentBrief", () => {
  it("tells Shappy to fill trolleys and stop before checkout", () => {
    const payload = buildShoppingPayload([
      { ...onion, checked: true },
      { ...brisket, checked: true },
      { ...milk, checked: true },
    ]);
    const brief = formatAgentBrief(payload);
    assert.match(brief, /Shappy/);
    assert.match(brief, /ADD ITEMS TO THE TROLLEY ONLY/);
    assert.match(brief, /Do not checkout/);
    assert.match(brief, /Coles-only: 1/);
    assert.match(brief, /Woolworths-only: 1/);
    assert.match(brief, /Either \(choose one store/);
    assert.match(brief, /"shopper": "Roland"/);
    assert.match(brief, /"timezone": "Australia\/Sydney"/);
  });
});
