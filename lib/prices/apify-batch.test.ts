import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  departmentForGroceryCategory,
  planApifyBatchStrategy,
  SEARCH_QUERY_RUN_LIMIT,
  WOOLWORTHS_DEPARTMENT,
} from "./apify-batch";

describe("Apify batch planning", () => {
  it("uses one search run per unique query when the list is small", () => {
    assert.equal(planApifyBatchStrategy(1), "search");
    assert.equal(planApifyBatchStrategy(SEARCH_QUERY_RUN_LIMIT), "search");
  });

  it("switches to department scrapes so a full list is a few runs", () => {
    assert.equal(planApifyBatchStrategy(SEARCH_QUERY_RUN_LIMIT + 1), "departments-then-fill");
    assert.equal(planApifyBatchStrategy(25), "departments-then-fill");
  });

  it("maps grocery sections onto Woolies departments", () => {
    assert.equal(departmentForGroceryCategory("Meat"), WOOLWORTHS_DEPARTMENT.meat);
    assert.equal(departmentForGroceryCategory("Produce"), WOOLWORTHS_DEPARTMENT.produce);
    assert.equal(departmentForGroceryCategory("Fridge"), WOOLWORTHS_DEPARTMENT.fridge);
    assert.equal(departmentForGroceryCategory("Bread"), WOOLWORTHS_DEPARTMENT.bakery);
    assert.equal(departmentForGroceryCategory("Pantry"), WOOLWORTHS_DEPARTMENT.pantry);
    assert.equal(departmentForGroceryCategory("Monthly"), WOOLWORTHS_DEPARTMENT.pantry);
  });
});
