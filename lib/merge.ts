import { categorizeIngredient } from "./categorize";
import { createId } from "./id";
import { combineQuantities } from "./quantity";
import type { GroceryItem, RecipeIngredient, StorePreference } from "./types";

const ALIASES: Record<string, string> = {
  "ground beef": "beef mince",
  "minced beef": "beef mince",
  "lean minced beef": "beef mince",
  "beef mince": "beef mince",
  "mince": "beef mince",
  "parmigiano": "parmesan",
  "parmigiano reggiano": "parmesan",
  "parmesan cheese": "parmesan",
  "cheddar": "tasty cheese",
  "cheddar cheese": "tasty cheese",
  "tasty cheese": "tasty cheese",
  "cherry tomato": "cherry tomatoes",
  "spring onion": "spring onion",
  "green onion": "spring onion",
  "scallion": "spring onion",
  "cilantro": "coriander",
  "eggplant": "eggplant",
  "aubergine": "eggplant",
  "zucchini": "zucchini",
  "courgette": "zucchini",
  "bell pepper": "capsicum",
  "red pepper": "capsicum",
  "capsicum": "capsicum",
  "arugula": "rocket",
  "rocket": "rocket",
  "tomato puree": "tomato paste",
  "tomato purée": "tomato paste",
  "tomato puree/puree": "tomato paste",
  "passata": "tomato paste",
  "hot beef stock": "beef stock",
  "beef stock": "beef stock",
  "chicken stock": "chicken stock",
  "wholemeal wonder white": "wholemeal wonder white",
  "wonder white": "wholemeal wonder white",
};

export function normalizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(fresh|dried|lean|large|small|medium|optional)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (ALIASES[cleaned]) return ALIASES[cleaned];

  const singular = cleaned
    .replace(/ies$/, "y")
    .replace(/oes$/, "o")
    .replace(/(?<!s)s$/, "");

  return ALIASES[singular] ?? singular;
}

export function mergeRecipeIngredients(
  current: GroceryItem[],
  incoming: RecipeIngredient[],
  recipeName: string,
  store: StorePreference = "Either",
): GroceryItem[] {
  const next = current.map((item) => ({ ...item }));

  for (const line of incoming) {
    if (line.excluded || line.alreadyHave) continue;
    const key = normalizeName(line.name);
    if (!key) continue;

    const matchIndex = next.findIndex(
      (item) => normalizeName(item.name) === key,
    );

    if (matchIndex >= 0) {
      const existing = next[matchIndex];
      const quantity = combineQuantities(existing.quantity, line.quantity);
      next[matchIndex] = {
        ...existing,
        quantity,
        included: true,
        checked: false,
        note: existing.note,
      };
      continue;
    }

    next.push({
      id: createId("recipe"),
      name: line.name,
      quantity: line.quantity || "1",
      category: line.category || categorizeIngredient(line.name),
      store,
      checked: false,
      included: true,
      source: "recipe",
      recipeName,
    });
  }

  return next;
}

export function toRecipeIngredient(
  name: string,
  quantity: string,
): RecipeIngredient {
  return {
    id: createId("ing"),
    name,
    quantity: quantity || "1",
    category: categorizeIngredient(name),
    alreadyHave: false,
    excluded: false,
  };
}
