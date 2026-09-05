"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_ITEMS } from "./staples";
import { loadState, saveState } from "./storage";
import type { GroceryItem } from "./types";

let snapshot = DEFAULT_ITEMS;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function readClient(): GroceryItem[] {
  if (!hydrated) {
    snapshot = loadState();
    hydrated = true;
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGroceryState() {
  const items = useSyncExternalStore(subscribe, readClient, () => DEFAULT_ITEMS);

  const setItems = useCallback(
    (updater: GroceryItem[] | ((current: GroceryItem[]) => GroceryItem[])) => {
      const current = readClient();
      const next = typeof updater === "function" ? updater(current) : updater;
      snapshot = next;
      hydrated = true;
      saveState(next);
      emit();
    },
    [],
  );

  return [items, setItems] as const;
}
