import { getApifyDebug } from "@/lib/prices/apify";
import { searchPrices } from "@/lib/prices/search";

export const dynamic = "force-dynamic";
/** Prefer a 60s budget when the host allows it. Vercel Hobby may still cap lower. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const quantity = url.searchParams.get("qty")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const refresh = url.searchParams.get("refresh") === "1";
  const debug = url.searchParams.get("debug") === "1";

  if (!query) {
    return Response.json({ error: "Missing item name." }, { status: 400 });
  }

  try {
    const result = await searchPrices(query, quantity, refresh, category);
    if (debug) {
      return Response.json({ ...result, debug: { apify: getApifyDebug() } });
    }
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price lookup failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
