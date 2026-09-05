import type { GroceryItem } from "@/lib/types";

export type SyncStatus = "local" | "locked" | "syncing" | "synced" | "offline" | "error";

export type CloudList = {
  items: GroceryItem[];
  updatedAt: string | null;
};

export type FirstConnectPrompt = {
  localUpdatedAt: string | null;
  localCount: number;
  cloudUpdatedAt: string | null;
  cloudCount: number;
  cloudItems: GroceryItem[];
};

export type SyncSnapshot = {
  status: SyncStatus;
  configured: boolean;
  unlocked: boolean;
  lastCloudSavedAt: string | null;
  lastError: string | null;
  firstConnect: FirstConnectPrompt | null;
};

export type FirstConnectDecision = "upload" | "download" | "ask" | "pull" | "push" | "noop";
