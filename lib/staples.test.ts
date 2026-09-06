import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_ITEMS, resetToStaples } from "./staples";

function byKey(key: string) {
  const item = DEFAULT_ITEMS.find((entry) => entry.stapleKey === key);
  assert.ok(item, `missing staple ${key}`);
  return item;
}

describe("DEFAULT_ITEMS quantity seeds", () => {
  it("turns x2 staples into count 2", () => {
    assert.equal(byKey("broccolini").count, 2);
    assert.equal(byKey("broccolini").unit, "");
    assert.equal(byKey("broccolini").quantity, "2×");
    assert.equal(byKey("avocado").count, 2);
    assert.equal(byKey("onion").count, 1);
    assert.equal(byKey("onion").quantity, "1");
  });

  it("keeps pack sizes on meat and milk", () => {
    assert.equal(byKey("brisket").count, 1);
    assert.equal(byKey("brisket").unit, "1.4kg");
    assert.equal(byKey("chicken-thighs").unit, "~600g");
    assert.equal(byKey("milk").unit, "2L");
    assert.equal(byKey("cherry-tomatoes").unit, "punnet");
    assert.equal(byKey("cherry-tomatoes").count, 1);
  });
});

describe("resetToStaples", () => {
  it("reloads sensible counts and keeps occasional include toggles", () => {
    const current = DEFAULT_ITEMS.map((item) =>
      item.stapleKey === "onion"
        ? { ...item, count: 5, quantity: "5×" }
        : item.stapleKey === "butter"
          ? { ...item, included: true }
          : item,
    );
    const reset = resetToStaples(current);
    const onion = reset.find((item) => item.stapleKey === "onion");
    const butter = reset.find((item) => item.stapleKey === "butter");
    const broccolini = reset.find((item) => item.stapleKey === "broccolini");
    assert.equal(onion?.count, 1);
    assert.equal(onion?.quantity, "1");
    assert.equal(broccolini?.count, 2);
    assert.equal(butter?.included, true);
  });
});
