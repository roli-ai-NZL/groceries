import { quantityFieldsFrom } from "./quantity";
import type { GroceryItem } from "./types";

type Seed = Omit<GroceryItem, "checked" | "included" | "store" | "count" | "unit"> & {
  included?: boolean;
  count?: number;
  unit?: string;
};

const WEEKLY: Seed[] = [
  {
    id: "staple-brisket",
    stapleKey: "brisket",
    name: "Brisket",
    quantity: "1.4kg",
    category: "Meat",
    source: "staple",
  },
  {
    id: "staple-beef-mince",
    stapleKey: "beef-mince",
    name: "Beef mince",
    quantity: "500g",
    category: "Meat",
    source: "staple",
  },
  {
    id: "staple-chicken-thighs",
    stapleKey: "chicken-thighs",
    name: "Chicken thighs",
    quantity: "~600g",
    category: "Meat",
    source: "staple",
  },
  {
    id: "staple-chicken-breast",
    stapleKey: "chicken-breast",
    name: "Chicken breast",
    quantity: "~500g",
    category: "Meat",
    source: "staple",
  },
  {
    id: "staple-bacon",
    stapleKey: "bacon",
    name: "Bacon",
    quantity: "~200g",
    category: "Meat",
    source: "staple",
  },
  {
    id: "staple-potatoes",
    stapleKey: "potatoes",
    name: "Potatoes",
    quantity: "~1kg",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-broccolini",
    stapleKey: "broccolini",
    name: "Broccolini",
    quantity: "x2",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-cos-lettuce",
    stapleKey: "cos-lettuce",
    name: "Cos lettuce",
    quantity: "x2",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-cherry-tomatoes",
    stapleKey: "cherry-tomatoes",
    name: "Cherry tomatoes",
    quantity: "1 punnet",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-avocado",
    stapleKey: "avocado",
    name: "Avocado",
    quantity: "x2",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-onion",
    stapleKey: "onion",
    name: "Onion",
    quantity: "1",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-carrot",
    stapleKey: "carrot",
    name: "Carrot",
    quantity: "1",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-lemon",
    stapleKey: "lemon",
    name: "Lemon",
    quantity: "1",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-blueberries",
    stapleKey: "blueberries",
    name: "Blueberries",
    quantity: "1 punnet",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-strawberries",
    stapleKey: "strawberries",
    name: "Strawberries",
    quantity: "1 punnet",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-bananas",
    stapleKey: "bananas",
    name: "Bananas",
    quantity: "1 bunch",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-mandarins",
    stapleKey: "mandarins",
    name: "Mandarins",
    quantity: "1 bag",
    category: "Produce",
    source: "staple",
  },
  {
    id: "staple-milk",
    stapleKey: "milk",
    name: "Milk",
    quantity: "2L",
    category: "Fridge",
    source: "staple",
  },
  {
    id: "staple-eggs",
    stapleKey: "eggs",
    name: "Eggs",
    quantity: "1 dozen",
    category: "Fridge",
    source: "staple",
  },
  {
    id: "staple-sour-cream",
    stapleKey: "sour-cream",
    name: "Sour cream",
    quantity: "1 tub",
    category: "Fridge",
    source: "staple",
  },
  {
    id: "staple-tasty-cheese",
    stapleKey: "tasty-cheese",
    name: "Tasty cheese",
    quantity: "1 block",
    category: "Fridge",
    source: "staple",
  },
  {
    id: "staple-parmesan",
    stapleKey: "parmesan",
    name: "Parmesan",
    quantity: "1 wedge",
    category: "Fridge",
    source: "staple",
  },
  {
    id: "staple-wonder-white",
    stapleKey: "wonder-white",
    name: "Wholemeal Wonder White",
    quantity: "1 loaf",
    category: "Bread",
    source: "staple",
    note: "Grab an extra loaf if croutons will eat into this one.",
  },
  {
    id: "staple-fettuccine",
    stapleKey: "fettuccine",
    name: "Fettuccine",
    quantity: "1 pack",
    category: "Pantry",
    source: "staple",
  },
  {
    id: "staple-penne",
    stapleKey: "penne",
    name: "Penne",
    quantity: "1 pack",
    category: "Pantry",
    source: "staple",
  },
  {
    id: "staple-dolmio",
    stapleKey: "dolmio",
    name: "Dolmio pasta sauce",
    quantity: "1 jar",
    category: "Pantry",
    source: "staple",
    note: "Jarred sauce already has tomato, herbs, and often garlic.",
  },
  {
    id: "staple-black-beans",
    stapleKey: "black-beans",
    name: "Black beans",
    quantity: "1 tin",
    category: "Pantry",
    source: "staple",
  },
  {
    id: "staple-caesar",
    stapleKey: "caesar-dressing",
    name: "Caesar dressing",
    quantity: "1 bottle",
    category: "Pantry",
    source: "staple",
  },
];

const OCCASIONAL: Seed[] = [
  {
    id: "occasional-butter",
    stapleKey: "butter",
    name: "Butter",
    quantity: "1 block",
    category: "Every few weeks",
    source: "occasional",
    included: false,
  },
  {
    id: "occasional-oats",
    stapleKey: "oats",
    name: "Oats",
    quantity: "1 bag",
    category: "Every few weeks",
    source: "occasional",
    included: false,
  },
  {
    id: "occasional-block-cheese",
    stapleKey: "block-cheese",
    name: "Block cheese",
    quantity: "1 block",
    category: "Every few weeks",
    source: "occasional",
    included: false,
  },
];

const MONTHLY: Seed[] = [
  {
    id: "monthly-minced-garlic",
    stapleKey: "minced-garlic",
    name: "Minced garlic",
    quantity: "1 jar",
    category: "Monthly",
    source: "monthly",
    included: false,
  },
  {
    id: "monthly-beef-stock",
    stapleKey: "beef-stock",
    name: "Beef stock",
    quantity: "1 carton",
    category: "Monthly",
    source: "monthly",
    included: false,
  },
  {
    id: "monthly-duck-fat",
    stapleKey: "duck-fat",
    name: "Duck fat",
    quantity: "1 jar",
    category: "Monthly",
    source: "monthly",
    included: false,
  },
  {
    id: "monthly-pesto",
    stapleKey: "pesto",
    name: "Pesto",
    quantity: "1 jar",
    category: "Monthly",
    source: "monthly",
    included: false,
  },
  {
    id: "monthly-sun-dried-tomatoes",
    stapleKey: "sun-dried-tomatoes",
    name: "Sun-dried tomatoes",
    quantity: "1 jar",
    category: "Monthly",
    source: "monthly",
    included: false,
  },
  {
    id: "monthly-tomato-paste",
    stapleKey: "tomato-paste",
    name: "Tomato paste",
    quantity: "1 jar",
    category: "Monthly",
    source: "monthly",
    included: false,
    note: "Optional for bolognese — deeper, thicker sauce vs one less jar. Dolmio already has tomato, herbs, and often garlic.",
  },
  {
    id: "monthly-red-wine",
    stapleKey: "red-wine",
    name: "Red wine",
    quantity: "1 bottle",
    category: "Monthly",
    source: "monthly",
    included: false,
  },
  {
    id: "monthly-tortillas",
    stapleKey: "tortillas",
    name: "Tortillas",
    quantity: "1 pack",
    category: "Monthly",
    source: "monthly",
    included: false,
  },
];

function hydrate(seed: Seed): GroceryItem {
  return {
    ...seed,
    ...quantityFieldsFrom(seed),
    store: "Either",
    checked: false,
    included: seed.included ?? true,
  };
}

export const DEFAULT_ITEMS: GroceryItem[] = [
  ...WEEKLY,
  ...OCCASIONAL,
  ...MONTHLY,
].map(hydrate);

export const PASTA_NOTE =
  "Jarred pasta sauce (like Dolmio) already has tomato, herbs, and often garlic. Tomato paste is optional for bolognese — use it for a deeper, thicker sauce, or skip it for one less jar.";

export function resetToStaples(current: GroceryItem[]): GroceryItem[] {
  const previous = new Map(
    current
      .filter((item) => item.stapleKey)
      .map((item) => [item.stapleKey, item]),
  );

  return DEFAULT_ITEMS.map((seed) => {
    const prior = previous.get(seed.stapleKey);
    if (seed.source === "occasional" || seed.source === "monthly") {
      return {
        ...seed,
        included: prior?.included ?? false,
        store: prior?.store ?? "Either",
        checked: false,
        count: seed.count,
        unit: seed.unit,
        quantity: seed.quantity,
        note: seed.note,
      };
    }
    return {
      ...seed,
      store: prior?.store ?? "Either",
    };
  });
}
