import { toRecipeIngredient } from "./merge";
import type { RecipeIngredient, RecipeMatch } from "./types";

type MealDbMeal = Record<string, string | null>;

function mealIngredients(meal: MealDbMeal): RecipeIngredient[] {
  const lines: RecipeIngredient[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = meal[`strIngredient${i}`]?.trim();
    const quantity = meal[`strMeasure${i}`]?.trim() ?? "";
    if (!name) continue;
    lines.push(toRecipeIngredient(name, quantity || "1"));
  }
  return lines;
}

function toMealMatch(meal: MealDbMeal): RecipeMatch {
  return {
    id: `themealdb-${meal.idMeal}`,
    name: meal.strMeal ?? "Untitled recipe",
    area: meal.strArea ?? undefined,
    category: meal.strCategory ?? undefined,
    thumbnail: meal.strMealThumb ?? undefined,
    source: "themealdb",
    sourceLabel: "TheMealDB",
    ingredients: mealIngredients(meal),
  };
}

async function searchMealDb(query: string): Promise<RecipeMatch[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error("TheMealDB is unavailable right now.");
  }
  const data = (await response.json()) as { meals: MealDbMeal[] | null };
  return (data.meals ?? []).slice(0, 6).map(toMealMatch);
}

type SpoonacularRecipe = {
  id: number;
  title: string;
  image?: string;
  cuisines?: string[];
  dishTypes?: string[];
  extendedIngredients?: Array<{
    name?: string;
    original?: string;
    amount?: number;
    unit?: string;
  }>;
};

async function searchSpoonacular(query: string, apiKey: string): Promise<RecipeMatch[]> {
  const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
  url.searchParams.set("query", query);
  url.searchParams.set("number", "5");
  url.searchParams.set("addRecipeInformation", "true");
  url.searchParams.set("fillIngredients", "true");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error("Spoonacular lookup failed.");
  }
  const data = (await response.json()) as { results?: SpoonacularRecipe[] };
  return (data.results ?? []).map((recipe) => ({
    id: `spoonacular-${recipe.id}`,
    name: recipe.title,
    area: recipe.cuisines?.[0],
    category: recipe.dishTypes?.[0],
    thumbnail: recipe.image,
    source: "spoonacular" as const,
    sourceLabel: "Spoonacular",
    ingredients: (recipe.extendedIngredients ?? []).map((ingredient) =>
      toRecipeIngredient(
        ingredient.name ?? ingredient.original ?? "Ingredient",
        ingredient.amount && ingredient.unit
          ? `${ingredient.amount} ${ingredient.unit}`
          : ingredient.original ?? "1",
      ),
    ),
  }));
}

const GENERIC_RECIPES: Array<{
  keys: string[];
  name: string;
  ingredients: Array<[string, string]>;
}> = [
  {
    keys: ["bolognese", "spaghetti bolognese", "spag bol"],
    name: "Spaghetti bolognese (generic)",
    ingredients: [
      ["Beef mince", "500g"],
      ["Onion", "1"],
      ["Garlic", "2 cloves"],
      ["Carrot", "1"],
      ["Dolmio pasta sauce", "1 jar"],
      ["Tomato paste", "1 tbsp (optional)"],
      ["Beef stock", "250ml"],
      ["Fettuccine or spaghetti", "400g"],
      ["Parmesan", "to serve"],
    ],
  },
  {
    keys: ["carbonara"],
    name: "Carbonara (generic)",
    ingredients: [
      ["Bacon or pancetta", "200g"],
      ["Eggs", "3"],
      ["Parmesan", "80g"],
      ["Fettuccine", "400g"],
      ["Black pepper", "to taste"],
    ],
  },
  {
    keys: ["caesar", "caesar salad"],
    name: "Caesar salad (generic)",
    ingredients: [
      ["Cos lettuce", "2"],
      ["Chicken breast", "400g"],
      ["Bacon", "100g"],
      ["Parmesan", "40g"],
      ["Caesar dressing", "1 bottle"],
      ["Wholemeal Wonder White", "4 slices"],
    ],
  },
  {
    keys: ["taco", "tacos"],
    name: "Tacos (generic)",
    ingredients: [
      ["Beef mince", "500g"],
      ["Tortillas", "1 pack"],
      ["Onion", "1"],
      ["Avocado", "2"],
      ["Sour cream", "1 tub"],
      ["Tasty cheese", "1 cup"],
      ["Cos lettuce", "1"],
    ],
  },
];

function genericFallback(query: string): RecipeMatch | null {
  const key = query.toLowerCase().trim();
  const match = GENERIC_RECIPES.find((recipe) =>
    recipe.keys.some((candidate) => key.includes(candidate) || candidate.includes(key)),
  );
  if (!match) return null;
  return {
    id: `generic-${match.keys[0]}`,
    name: match.name,
    source: "generic",
    sourceLabel: "Generic pantry version",
    ingredients: match.ingredients.map(([name, quantity]) =>
      toRecipeIngredient(name, quantity),
    ),
  };
}

export async function lookupRecipes(query: string): Promise<{
  meals: RecipeMatch[];
  notice?: string;
}> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Type a recipe name first.");
  }

  const attempts = Array.from(
    new Set([
      trimmed,
      trimmed.replace(/recipe$/i, "").trim(),
      trimmed.split(/\s+/).slice(0, 2).join(" "),
      trimmed.split(/\s+/)[0],
    ]),
  ).filter((value) => value.length >= 3);

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const meals = await searchMealDb(attempt);
      if (meals.length) return { meals };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Recipe lookup failed.");
    }
  }

  const spoonacularKey = process.env.SPOONACULAR_API_KEY;
  if (spoonacularKey) {
    try {
      const meals = await searchSpoonacular(trimmed, spoonacularKey);
      if (meals.length) return { meals };
    } catch (error) {
      lastError = error instanceof Error ? error : lastError;
    }
  }

  const generic = genericFallback(trimmed);
  if (generic) {
    return {
      meals: [generic],
      notice: lastError
        ? "Couldn't reach the recipe service, so this is a generic pantry version you can edit."
        : "No exact web match — here's a generic version to review.",
    };
  }

  throw lastError ?? new Error(`Couldn't find a typical recipe for “${trimmed}”. Try a simpler name like “bolognese” or “carbonara”.`);
}
