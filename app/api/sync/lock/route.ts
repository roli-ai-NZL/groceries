import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  return Response.json({ ok: true });
}
