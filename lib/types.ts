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
  quantity: string;
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

export type ShoppingPayloadItem = {
  name: string;
  quantity: string;
  category: Category;
  store: StorePreference;
  note?: string;
};

export type ShoppingPayload = {
  generatedAt: string;
  timezone: "Australia/Sydney";
  shopper: "Roland";
  locale: "en-AU";
  instructions: string;
  itemCount: number;
  items: ShoppingPayloadItem[];
  byCategory: Record<string, ShoppingPayloadItem[]>;
  byStore: Record<string, ShoppingPayloadItem[]>;
};

export type PersistedState = {
  version: number;
  items: GroceryItem[];
};

export const STORAGE_KEY = "roland-groceries-v1";
export const THEME_KEY = "roland-groceries-theme";
export const STATE_VERSION = 1;
