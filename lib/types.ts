export const CATEGORIES = [
  "Meat",
  "Produce",
  "Fridge",
  "Bread",
  "Pantry",
  "Every few weeks",
  "Monthly",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const STORES = ["Either", "Coles", "Woolworths"] as const;
export type StorePreference = (typeof STORES)[number];

export type ItemSource = "staple" | "occasional" | "monthly" | "recipe" | "custom";

export type GroceryItem = {
  id: string;
  name: string;
  /** Display quantity, e.g. `5×`, `1.4kg`, `2× 1.4kg`. Kept for older exports/sync. */
  quantity: string;
  /** How many to buy. Min 1. Derived from `quantity` for older lists. */
  count: number;
  /** Optional pack size / unit (`kg`, `punnet`, `1.4kg`). */
  unit: string;
  category: Category;
  store: StorePreference;
  checked: boolean;
  /** Occasional / monthly items start off until Roland includes them this week. */
  included: boolean;
  note?: string;
  source: ItemSource;
  stapleKey?: string;
  recipeName?: string;
};

export type RecipeIngredient = {
  id: string;
  name: string;
  quantity: string;
  count: number;
  unit: string;
  category: Category;
  alreadyHave: boolean;
  excluded: boolean;
};

export type RecipeMatch = {
  id: string;
  name: string;
  area?: string;
  category?: string;
  thumbnail?: string;
  source: "themealdb" | "spoonacular" | "generic";
  sourceLabel: string;
  ingredients: RecipeIngredient[];
};

export type ShoppingMatchedProduct = {
  id: string;
  name: string;
  url?: string;
  packSize?: string;
};

export type ShoppingPayloadItem = {
  name: string;
  quantity: string;
  count: number;
  unit?: string;
  category: Category;
  store: StorePreference;
  note?: string;
  /** Top Coles / Woolies hits from the last Estimate, when still in the price cache. */
  matched?: {
    coles?: ShoppingMatchedProduct;
    woolworths?: ShoppingMatchedProduct;
  };
};

export const CART_STORES = ["Coles", "Woolworths", "Either"] as const;
export type CartStore = (typeof CART_STORES)[number];

export type ShoppingPayload = {
  generatedAt: string;
  timezone: "Australia/Sydney";
  shopper: "Roland";
  locale: "en-AU";
  instructions: string;
  itemCount: number;
  items: ShoppingPayloadItem[];
  byCategory: Record<string, ShoppingPayloadItem[]>;
  byStore: Record<CartStore, ShoppingPayloadItem[]>;
};

export type PersistedState = {
  version: number;
  items: GroceryItem[];
};

export const STORAGE_KEY = "roland-groceries-v1";
export const THEME_KEY = "roland-groceries-theme";
export const STATE_VERSION = 1;
