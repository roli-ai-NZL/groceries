import type { GroceryItem } from "@/lib/types";
import type { CloudList } from "./types";

async function readJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorMessage(body: Record<string, unknown>, fallback: string) {
  return typeof body.error === "string" ? body.error : fallback;
}

function asCloudList(body: Record<string, unknown>): CloudList {
  return {
    items: Array.isArray(body.items) ? (body.items as GroceryItem[]) : [],
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
  };
}

export async function fetchCloudList(): Promise<
  { ok: true; list: CloudList } | { ok: false; status: number; error: string }
> {
  try {
    const response = await fetch("/api/sync", { cache: "no-store" });
    const body = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: errorMessage(body, "Couldn’t load the cloud list."),
      };
    }
    return { ok: true, list: asCloudList(body) };
  } catch {
    return { ok: false, status: 0, error: "Couldn’t reach the cloud list." };
  }
}

export async function pushCloudList(items: GroceryItem[], updatedAt: string) {
  try {
    const response = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, updatedAt }),
    });
    const body = await readJson(response);
    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        error: errorMessage(body, "Couldn’t save the list to the cloud."),
      };
    }
    return { ok: true as const, list: asCloudList(body) };
  } catch {
    return { ok: false as const, status: 0, error: "Couldn’t reach the cloud list." };
  }
}

export async function unlockCloud(accessCode: string) {
  try {
    const response = await fetch("/api/sync/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode }),
    });
    const body = await readJson(response);
    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        error: errorMessage(body, "Couldn’t unlock cloud sync."),
      };
    }
    return { ok: true as const, list: asCloudList(body) };
  } catch {
    return { ok: false as const, status: 0, error: "Couldn’t reach the cloud list." };
  }
}

export async function lockCloud() {
  try {
    await fetch("/api/sync/lock", { method: "POST" });
  } catch {
    // Local lock still applies if the request fails.
  }
}
