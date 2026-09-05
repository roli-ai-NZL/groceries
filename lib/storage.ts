import { DEFAULT_ITEMS } from "./staples";
import {
  STATE_VERSION,
  STORAGE_KEY,
  type GroceryItem,
  type PersistedState,
} from "./types";

export function isGroceryItem(value: unknown): value is GroceryItem {
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

export function sanitizeItems(value: unknown): GroceryItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isGroceryItem);
}

export type LoadedState = {
  items: GroceryItem[];
  updatedAt: string | null;
  hadLocalSave: boolean;
};

export function loadPersisted(): LoadedState {
  if (typeof window === "undefined") {
    return { items: DEFAULT_ITEMS, updatedAt: null, hadLocalSave: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: DEFAULT_ITEMS, updatedAt: null, hadLocalSave: false };
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.items)) {
      return { items: DEFAULT_ITEMS, updatedAt: null, hadLocalSave: false };
    }
    const items = sanitizeItems(parsed.items);
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : null;
    return {
      items: items.length ? items : DEFAULT_ITEMS,
      updatedAt,
      hadLocalSave: true,
    };
  } catch {
    return { items: DEFAULT_ITEMS, updatedAt: null, hadLocalSave: false };
  }
}

export function loadState(): GroceryItem[] {
  return loadPersisted().items;
}

export function saveState(items: GroceryItem[], updatedAt?: string) {
  if (typeof window === "undefined") return;
  const payload: PersistedState = { version: STATE_VERSION, items };
  if (updatedAt) payload.updatedAt = updatedAt;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function exportState(items: GroceryItem[], updatedAt?: string | null): string {
  const payload: PersistedState = { version: STATE_VERSION, items };
  if (updatedAt) payload.updatedAt = updatedAt;
  return JSON.stringify(payload, null, 2);
}

export function importState(raw: string): GroceryItem[] {
  const parsed = JSON.parse(raw) as PersistedState;
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("That file is not a grocery list export.");
  }
  const items = sanitizeItems(parsed.items);
  if (!items.length) {
    throw new Error("No grocery items found in that file.");
  }
  return items;
}
