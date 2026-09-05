import { parseQuantity } from "@/lib/quantity";
import type { PricedProduct } from "./types";

const STOP = new Set([
  "the",
  "and",
  "or",
  "a",
  "an",
  "of",
  "with",
  "approx",
  "approximately",
  "pack",
  "each",
  "from",
  "deli",
  "coles",
  "woolworths",
  "woolies",
]);

const SEARCH_ALIASES: Record<string, string> = {
  brisket: "beef brisket",
  "tasty cheese": "tasty cheese block",
  "block cheese": "tasty cheese block",
  "wholemeal wonder white": "wonder white wholemeal",
  "wonder white": "wonder white wholemeal",
  "dolmio pasta sauce": "dolmio pasta sauce bolognese",
  "caesar dressing": "caesar dressing",
  "black beans": "black beans",
  "minced garlic": "minced garlic jar",
  "sun-dried tomatoes": "sun dried tomatoes",
  "sun dried tomatoes": "sun dried tomatoes",
  bananas: "banana bunch",
  potatoes: "washed potatoes",
  milk: "full cream milk",
  eggs: "dozen free range eggs",
  bacon: "middle bacon",
};

const SNACK_WORDS = [
  "chip",
  "chips",
  "crisp",
  "chocolate",
  "lolly",
  "lollies",
  "ice",
  "baby",
  "pet",
  "dog",
  "cat",
  "treat",
  "cracker",
  "crackers",
  "biscuit",
  "cookie",
  "sauce",
  "seasoning",
  "stock",
  "flavour",
  "flavor",
  "pie",
  "nugget",
  "bar",
  "jerky",
  "biltong",
  "rub",
  "seasoning",
  "marinade",
];

export function searchQueryFor(name: string, quantity?: string, category?: string): string {
  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  let aliased = SEARCH_ALIASES[key] ?? name;
  if (category === "Meat" && /^(brisket|steak|sausage|ribs)$/i.test(key)) {
    aliased = `beef ${aliased}`;
  }
  const qty = quantity?.replace(/^~/, "").trim();
  if (qty && /^(2l|1kg|500g|1 dozen|1 loaf)$/i.test(qty)) {
    return `${aliased} ${qty}`;
  }
  return aliased;
}

function comparableRatio(
  wanted: ReturnType<typeof parseQuantity>,
  pack: ReturnType<typeof parseQuantity>,
): number | null {
  if (!wanted || !pack || pack.value <= 0) return null;
  if (wanted.unit === "dozen") wanted = { ...wanted, value: wanted.value * 12, unit: "item" };
  if (pack.unit === "dozen") pack = { ...pack, value: pack.value * 12, unit: "item" };
  const mass: Record<string, number> = { g: 1, kg: 1000 };
  const volume: Record<string, number> = { ml: 1, l: 1000 };
  if (wanted.unit === pack.unit) return pack.value / wanted.value;
  if (mass[wanted.unit] && mass[pack.unit]) {
    return (pack.value * mass[pack.unit]) / (wanted.value * mass[wanted.unit]);
  }
  if (volume[wanted.unit] && volume[pack.unit]) {
    return (pack.value * volume[pack.unit]) / (wanted.value * volume[wanted.unit]);
  }
  return null;
}

export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP.has(token) && !/^\d+$/.test(token));
}

export function scoreProduct(
  query: string,
  product: Omit<PricedProduct, "confidence">,
  quantity?: string,
  category?: string,
): number {
  const queryTokens = tokens(query);
  const hay = tokens(`${product.brand ?? ""} ${product.name} ${product.packSize}`);
  if (!queryTokens.length) return 0.2;

  const hit = queryTokens.filter((token) => hay.includes(token) || hay.some((word) => word.includes(token) || token.includes(word)));
  let score = hit.length / queryTokens.length;

  if (hit.length === queryTokens.length) score += 0.18;
  if (product.onSpecial) score += 0.03;
  if (!product.available || product.price == null) score -= 0.35;

  const extra = hay.filter((word) => !queryTokens.some((token) => word.includes(token) || token.includes(word)));
  const snackQuery = queryTokens.some((token) => ["chip", "chips", "chocolate", "lolly", "biscuit"].includes(token));
  if (!snackQuery && extra.some((word) => SNACK_WORDS.includes(word))) {
    score -= 0.45;
  }

  if (category === "Meat" && extra.some((word) => ["chip", "chips", "pie", "nugget", "stock", "flavour", "flavor", "gravy", "meal", "rub", "fried", "crumbed", "southern"].includes(word))) {
    score -= 0.35;
  }
  if (queryTokens.includes("beef") && extra.includes("pork")) score -= 0.25;

  if (quantity) {
    const wanted = parseQuantity(quantity);
    const pack = parseQuantity(product.packSize.replace(/approx\.?/i, "").replace(/\bper\b/i, "").trim());
    const ratio = comparableRatio(wanted, pack);
    if (ratio != null) {
      if (ratio >= 0.6 && ratio <= 1.6) score += 0.16;
      else if (ratio > 4 || ratio < 0.2) score -= 0.4;
      else if (ratio > 2.5 || ratio < 0.35) score -= 0.12;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function rankMatches(
  query: string,
  products: Array<Omit<PricedProduct, "confidence">>,
  quantity?: string,
  category?: string,
  limit = 6,
): PricedProduct[] {
  return products
    .map((product) => ({
      ...product,
      confidence: scoreProduct(query, product, quantity, category),
    }))
    .filter((product) => product.price != null && product.confidence >= 0.22)
    .sort((a, b) => {
      const diff = b.confidence - a.confidence;
      if (Math.abs(diff) > 0.04) return diff;
      return (a.price ?? 99) - (b.price ?? 99);
    })
    .slice(0, limit);
}

export function isWeakMatch(product: PricedProduct | null | undefined): boolean {
  return !product || product.confidence < 0.55;
}
