import { sanitizeItems } from "@/lib/storage";
import { getSupabaseEnv } from "./config";
import type { CloudList } from "./types";

type RpcError = {
  message?: string;
  code?: string;
};

export class SyncRpcError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const env = getSupabaseEnv();
  if (!env) {
    throw new SyncRpcError("Cloud sync is not configured.", 503);
  }

  const response = await fetch(`${env.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${env.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  if (!response.ok) {
    const error = parsed as RpcError | null;
    const message =
      error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : "Couldn’t reach the cloud list.";
    const code = error && typeof error === "object" ? error.code : undefined;
    const status =
      code === "28000" || /invalid access code/i.test(message)
        ? 401
        : code === "P0002" || /not set up/i.test(message)
          ? 404
          : response.status === 404
            ? 404
            : response.status >= 400 && response.status < 500
              ? response.status
              : 502;
    throw new SyncRpcError(
      response.status === 404
        ? "Cloud list is not set up yet. Run supabase/schema.sql in the Supabase SQL editor."
        : message,
      status,
      code,
    );
  }

  return parsed as T;
}

type RpcList = {
  items?: unknown;
  updated_at?: unknown;
};

function asCloudList(payload: RpcList | null): CloudList {
  const items = sanitizeItems(payload?.items);
  const updatedAt = typeof payload?.updated_at === "string" ? payload.updated_at : null;
  return { items, updatedAt };
}

export async function getHouseholdList(accessCode: string): Promise<CloudList> {
  const payload = await rpc<RpcList>("get_household_list", { access_code: accessCode });
  return asCloudList(payload);
}

export async function saveHouseholdList(
  accessCode: string,
  items: unknown,
  updatedAt: string,
): Promise<CloudList> {
  const payload = await rpc<RpcList>("save_household_list", {
    access_code: accessCode,
    new_items: items,
    client_updated_at: updatedAt,
  });
  return asCloudList(payload);
}
