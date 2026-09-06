import { withQuantityFields } from "./quantity";
import { DEFAULT_ITEMS } from "./staples";
import {
  STATE_VERSION,
  STORAGE_KEY,
  type GroceryItem,
  type PersistedState,
} from "./types";

function isItem(value: unknown): value is GroceryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as GroceryItem;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.quantity === "string" &&
    typeof item.category === "string" &&
    typeof item.store === "string" &&
    typeof item.checked === "boolean" &&
    typeof item.included === "boolean"
  );
}

export function normalizeGroceryItem(item: GroceryItem): GroceryItem {
  return withQuantityFields(item);
}

function normalizeItems(items: GroceryItem[]): GroceryItem[] {
  return items.map(normalizeGroceryItem);
}

export function loadState(): GroceryItem[] {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ITEMS;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.items)) {
      return DEFAULT_ITEMS;
    }
    const items = normalizeItems(parsed.items.filter(isItem));
    return items.length ? items : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

export function saveState(items: GroceryItem[]) {
  if (typeof window === "undefined") return;
  const payload: PersistedState = { version: STATE_VERSION, items };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function exportState(items: GroceryItem[]): string {
  const payload: PersistedState = { version: STATE_VERSION, items };
  return JSON.stringify(payload, null, 2);
}

export function importState(raw: string): GroceryItem[] {
  const parsed = JSON.parse(raw) as PersistedState;
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("That file is not a grocery list export.");
  }
  const items = normalizeItems(parsed.items.filter(isItem));
  if (!items.length) {
    throw new Error("No grocery items found in that file.");
  }
  return items;
}
