import { cookies } from "next/headers";
import { isCloudConfigured } from "@/lib/sync/config";
import { clientKey, tooManyUnlocks } from "@/lib/sync/rateLimit";
import { getHouseholdList, SyncRpcError } from "@/lib/sync/rpc";
import { ACCESS_COOKIE } from "@/lib/types";

export const dynamic = "force-dynamic";

const MIN_CODE = 6;
const MAX_CODE = 200;

export async function POST(request: Request) {
  if (!isCloudConfigured()) {
    return Response.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }

  if (tooManyUnlocks(clientKey(request))) {
    return Response.json(
      { error: "Too many unlock attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the household access code as JSON." }, { status: 400 });
  }

  const accessCode =
    body && typeof body === "object" && "accessCode" in body && typeof body.accessCode === "string"
      ? body.accessCode.trim()
      : "";

  if (accessCode.length < MIN_CODE || accessCode.length > MAX_CODE) {
    return Response.json(
      { error: `Access code must be ${MIN_CODE}–${MAX_CODE} characters.` },
      { status: 400 },
    );
  }

  try {
    const list = await getHouseholdList(accessCode);
    const store = await cookies();
    store.set(ACCESS_COOKIE, accessCode, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
    return Response.json({ items: list.items, updatedAt: list.updatedAt });
  } catch (error) {
    if (error instanceof SyncRpcError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Couldn’t reach the cloud list." }, { status: 502 });
  }
}
