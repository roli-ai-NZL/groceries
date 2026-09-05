import { searchPrices } from "@/lib/prices/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const quantity = url.searchParams.get("qty")?.trim() ?? "";
  const refresh = url.searchParams.get("refresh") === "1";

  if (!query) {
    return Response.json({ error: "Missing item name." }, { status: 400 });
  }

  try {
    const result = await searchPrices(query, quantity, refresh);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price lookup failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
