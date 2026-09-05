import { cookies } from "next/headers";
import { sanitizeItems } from "@/lib/storage";
import { isCloudConfigured } from "@/lib/sync/config";
import { getHouseholdList, saveHouseholdList, SyncRpcError } from "@/lib/sync/rpc";
import { ACCESS_COOKIE } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 2000;

function rpcResponse(error: unknown) {
  if (error instanceof SyncRpcError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Couldn’t reach the cloud list." }, { status: 502 });
}

async function readAccessCode() {
  const store = await cookies();
  const value = store.get(ACCESS_COOKIE)?.value?.trim() ?? "";
  return value || null;
}

export async function GET() {
  if (!isCloudConfigured()) {
    return Response.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }

  const accessCode = await readAccessCode();
  if (!accessCode) {
    return Response.json({ error: "Unlock this device with the household access code." }, { status: 401 });
  }

  try {
    const list = await getHouseholdList(accessCode);
    return Response.json({ items: list.items, updatedAt: list.updatedAt });
  } catch (error) {
    return rpcResponse(error);
  }
}

export async function PUT(request: Request) {
  if (!isCloudConfigured()) {
    return Response.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }

  const accessCode = await readAccessCode();
  if (!accessCode) {
    return Response.json({ error: "Unlock this device with the household access code." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That save payload was not valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "That save payload was empty." }, { status: 400 });
  }

  const payload = body as { items?: unknown; updatedAt?: unknown };
  if (!Array.isArray(payload.items)) {
    return Response.json({ error: "items must be an array." }, { status: 400 });
  }
  if (payload.items.length > MAX_ITEMS) {
    return Response.json({ error: "That list is too large to sync." }, { status: 400 });
  }

  const items = sanitizeItems(payload.items);
  const updatedAt =
    typeof payload.updatedAt === "string" && !Number.isNaN(Date.parse(payload.updatedAt))
      ? payload.updatedAt
      : new Date().toISOString();

  try {
    const list = await saveHouseholdList(accessCode, items, updatedAt);
    return Response.json({ items: list.items, updatedAt: list.updatedAt });
  } catch (error) {
    return rpcResponse(error);
  }
}
