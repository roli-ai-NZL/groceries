import { lookupRecipes } from "@/lib/recipes";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return Response.json({ error: "Type a recipe name first." }, { status: 400 });
  }

  try {
    const result = await lookupRecipes(query);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't look up that recipe. Try again in a moment.";
    return Response.json({ error: message }, { status: 404 });
  }
}
