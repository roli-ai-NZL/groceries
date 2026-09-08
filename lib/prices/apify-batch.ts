/** crawlerbros department node IDs (enum order follows Woolies nav). */
export const WOOLWORTHS_DEPARTMENT = {
  produce: "1_D5A2236",
  fridge: "1_6E4F4E4",
  bakery: "1_DEB537E",
  meat: "1_ACA2FC2",
  pantry: "1_717445A",
  drinks: "1_5AF3A0A",
} as const;

/** Unique-query searches are cheap enough when the list is this small. */
export const SEARCH_QUERY_RUN_LIMIT = 4;
export const MAX_FILL_SEARCHES = 8;
export const CATEGORY_MAX_ITEMS = 36;
export const SEARCH_MAX_ITEMS = 12;

export function departmentForGroceryCategory(category: string): string {
  switch (category) {
    case "Meat":
      return WOOLWORTHS_DEPARTMENT.meat;
    case "Produce":
      return WOOLWORTHS_DEPARTMENT.produce;
    case "Fridge":
    case "Every few weeks":
      return WOOLWORTHS_DEPARTMENT.fridge;
    case "Bread":
      return WOOLWORTHS_DEPARTMENT.bakery;
    default:
      return WOOLWORTHS_DEPARTMENT.pantry;
  }
}

export type ApifyBatchStrategy = "search" | "departments-then-fill";

export function planApifyBatchStrategy(uniqueQueryCount: number): ApifyBatchStrategy {
  return uniqueQueryCount <= SEARCH_QUERY_RUN_LIMIT ? "search" : "departments-then-fill";
}
