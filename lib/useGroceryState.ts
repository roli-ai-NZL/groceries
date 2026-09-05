"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { fetchCloudList, lockCloud, pushCloudList, unlockCloud } from "./sync/client";
import { isCloudConfigured } from "./sync/config";
import { decideSyncAction } from "./sync/decide";
import type { FirstConnectPrompt, SyncSnapshot } from "./sync/types";
import { DEFAULT_ITEMS } from "./staples";
import { loadPersisted, saveState } from "./storage";
import { CLOUD_PAIR_KEY, type GroceryItem } from "./types";

let snapshot = DEFAULT_ITEMS;
let updatedAt: string | null = null;
let hadLocalSave = false;
let hydrated = false;

const itemListeners = new Set<() => void>();

function emitItems() {
  itemListeners.forEach((listener) => listener());
}

function readClient(): GroceryItem[] {
  if (!hydrated) {
    const loaded = loadPersisted();
    snapshot = loaded.items;
    updatedAt = loaded.updatedAt;
    hadLocalSave = loaded.hadLocalSave;
    hydrated = true;
  }
  return snapshot;
}

function persistLocal(items: GroceryItem[], nextUpdatedAt: string) {
  snapshot = items;
  updatedAt = nextUpdatedAt;
  hydrated = true;
  hadLocalSave = true;
  saveState(items, nextUpdatedAt);
  emitItems();
}

function subscribeItems(listener: () => void) {
  itemListeners.add(listener);
  return () => itemListeners.delete(listener);
}

const configured = isCloudConfigured();

let sync: SyncSnapshot = {
  status: configured ? "syncing" : "local",
  configured,
  unlocked: false,
  lastCloudSavedAt: null,
  lastError: null,
  firstConnect: null,
};

const syncListeners = new Set<() => void>();

function emitSync() {
  syncListeners.forEach((listener) => listener());
}

function patchSync(partial: Partial<SyncSnapshot>) {
  sync = { ...sync, ...partial };
  emitSync();
}

function subscribeSync(listener: () => void) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function isPaired() {
  return typeof window !== "undefined" && window.localStorage.getItem(CLOUD_PAIR_KEY) === "1";
}

function markPaired() {
  window.localStorage.setItem(CLOUD_PAIR_KEY, "1");
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveGeneration = 0;
let booted = false;

function applyCloud(list: { items: GroceryItem[]; updatedAt: string | null }) {
  const nextUpdatedAt = list.updatedAt ?? new Date().toISOString();
  persistLocal(list.items, nextUpdatedAt);
  patchSync({
    status: "synced",
    unlocked: true,
    lastCloudSavedAt: list.updatedAt,
    lastError: null,
    firstConnect: null,
  });
}

async function flushCloudSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!sync.configured || !sync.unlocked || sync.firstConnect) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    patchSync({ status: "offline", lastError: null });
    return;
  }

  const generation = ++saveGeneration;
  const items = snapshot;
  const stamp = updatedAt ?? new Date().toISOString();
  patchSync({ status: "syncing", lastError: null });

  const result = await pushCloudList(items, stamp);
  if (generation !== saveGeneration) return;

  if (!result.ok) {
    if (result.status === 401) {
      patchSync({ status: "locked", unlocked: false, lastError: result.error });
      return;
    }
    patchSync({
      status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error",
      lastError: result.error,
    });
    return;
  }

  patchSync({
    status: "synced",
    unlocked: true,
    lastCloudSavedAt: result.list.updatedAt,
    lastError: null,
  });
}

function scheduleCloudSave() {
  if (!sync.configured || !sync.unlocked || sync.firstConnect) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    patchSync({ status: "offline", lastError: null });
    return;
  }
  patchSync({ status: "syncing", lastError: null });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flushCloudSave();
  }, 800);
}

function promptFromCloud(cloud: { items: GroceryItem[]; updatedAt: string | null }): FirstConnectPrompt {
  return {
    localUpdatedAt: updatedAt,
    localCount: snapshot.length,
    cloudUpdatedAt: cloud.updatedAt,
    cloudCount: cloud.items.length,
    cloudItems: cloud.items,
  };
}

async function reconcile(list: { items: GroceryItem[]; updatedAt: string | null }) {
  const action = decideSyncAction({
    paired: isPaired(),
    hadLocalSave,
    localUpdatedAt: updatedAt,
    cloudUpdatedAt: list.updatedAt,
    cloudCount: list.items.length,
  });

  if (action === "ask") {
    patchSync({
      status: "synced",
      unlocked: true,
      lastCloudSavedAt: list.updatedAt,
      lastError: null,
      firstConnect: promptFromCloud(list),
    });
    return;
  }

  if (action === "download" || action === "pull") {
    markPaired();
    applyCloud(list);
    return;
  }

  markPaired();
  patchSync({
    status: "synced",
    unlocked: true,
    lastCloudSavedAt: list.updatedAt,
    lastError: null,
    firstConnect: null,
  });

  if (action === "upload" || action === "push") {
    await flushCloudSave();
  }
}

async function bootSync() {
  if (!configured) {
    patchSync({ status: "local", configured: false, unlocked: false });
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    patchSync({ status: "offline", lastError: null });
    return;
  }

  patchSync({ status: "syncing", lastError: null });
  const result = await fetchCloudList();
  if (!result.ok) {
    if (result.status === 401) {
      patchSync({ status: "locked", unlocked: false, lastError: null });
      return;
    }
    if (result.status === 503) {
      patchSync({ status: "local", configured: false, unlocked: false });
      return;
    }
    patchSync({
      status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error",
      lastError: result.error,
    });
    return;
  }

  await reconcile(result.list);
}

async function pullIfIdle() {
  if (!sync.configured || !sync.unlocked || sync.firstConnect || saveTimer) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    patchSync({ status: "offline", lastError: null });
    return;
  }
  const result = await fetchCloudList();
  if (!result.ok) {
    if (result.status === 401) {
      patchSync({ status: "locked", unlocked: false, lastError: result.error });
      return;
    }
    return;
  }
  await reconcile(result.list);
}

export function useGroceryState() {
  const items = useSyncExternalStore(subscribeItems, readClient, () => DEFAULT_ITEMS);

  const setItems = useCallback(
    (updater: GroceryItem[] | ((current: GroceryItem[]) => GroceryItem[])) => {
      const current = readClient();
      const next = typeof updater === "function" ? updater(current) : updater;
      persistLocal(next, new Date().toISOString());
      scheduleCloudSave();
    },
    [],
  );

  return [items, setItems] as const;
}

export function useGrocerySync() {
  const state = useSyncExternalStore(subscribeSync, () => sync, () => sync);

  useEffect(() => {
    if (!booted) {
      booted = true;
      readClient();
      void bootSync();
    }

    function onOnline() {
      if (sync.unlocked) void flushCloudSave();
      else void bootSync();
    }
    function onOffline() {
      if (sync.configured) patchSync({ status: "offline", lastError: null });
    }
    function onVisible() {
      if (document.visibilityState === "visible") void pullIfIdle();
    }
    function onPageHide() {
      void flushCloudSave();
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  const unlock = useCallback(async (accessCode: string) => {
    patchSync({ status: "syncing", lastError: null });
    const result = await unlockCloud(accessCode);
    if (!result.ok) {
      patchSync({ status: "locked", unlocked: false, lastError: result.error });
      return { ok: false as const, error: result.error };
    }
    await reconcile(result.list);
    return { ok: true as const };
  }, []);

  const lock = useCallback(async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await lockCloud();
    patchSync({
      status: "locked",
      unlocked: false,
      lastCloudSavedAt: null,
      lastError: null,
      firstConnect: null,
    });
  }, []);

  const reloadFromCloud = useCallback(async () => {
    if (!sync.configured) return;
    patchSync({ status: "syncing", lastError: null, firstConnect: null });
    const result = await fetchCloudList();
    if (!result.ok) {
      if (result.status === 401) {
        patchSync({ status: "locked", unlocked: false, lastError: result.error });
        return;
      }
      patchSync({ status: "error", lastError: result.error });
      return;
    }
    markPaired();
    applyCloud(result.list);
  }, []);

  const resolveFirstConnect = useCallback(async (choice: "upload" | "download") => {
    const prompt = sync.firstConnect;
    if (!prompt) return;
    markPaired();
    if (choice === "download") {
      applyCloud({ items: prompt.cloudItems, updatedAt: prompt.cloudUpdatedAt });
      return;
    }
    patchSync({ firstConnect: null, unlocked: true, lastError: null });
    await flushCloudSave();
  }, []);

  const dismissFirstConnect = useCallback(() => {
    patchSync({ firstConnect: null, unlocked: true, lastError: null });
  }, []);

  const retrySync = useCallback(() => {
    void bootSync();
  }, []);

  return {
    ...state,
    unlock,
    lock,
    reloadFromCloud,
    resolveFirstConnect,
    dismissFirstConnect,
    retrySync,
  };
}
