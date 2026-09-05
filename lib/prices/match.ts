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
  "wholemeal wonder white": "wonder white wholemeal",
  "wonder white": "wonder white wholemeal",
  "dolmio pasta sauce": "dolmio pasta sauce bolognese",
  "tasty cheese": "tasty cheese",
  "block cheese": "tasty cheese block",
  "caesar dressing": "caesar dressing",
  "black beans": "black beans",
  "minced garlic": "minced garlic jar",
  "sun-dried tomatoes": "sun dried tomatoes",
  "sun dried tomatoes": "sun dried tomatoes",
};

export function searchQueryFor(name: string, quantity?: string): string {
  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  const aliased = SEARCH_ALIASES[key] ?? name;
  const qty = quantity?.replace(/^~/, "").trim();
  if (qty && /^(2l|1kg|500g|1 dozen|1 loaf)$/i.test(qty)) {
    return `${aliased} ${qty}`;
  }
  return aliased;
}

export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP.has(token) && !/^\d+$/.test(token));
}

export function scoreProduct(query: string, product: Omit<PricedProduct, "confidence">, quantity?: string): number {
  const queryTokens = tokens(query);
  const hay = tokens(`${product.brand ?? ""} ${product.name} ${product.packSize}`);
  if (!queryTokens.length) return 0.2;

  const hit = queryTokens.filter((token) => hay.includes(token) || hay.some((word) => word.includes(token) || token.includes(word)));
  let score = hit.length / queryTokens.length;

  if (hit.length === queryTokens.length) score += 0.18;
  if (product.onSpecial) score += 0.03;
  if (!product.available || product.price == null) score -= 0.35;

  const extra = hay.filter((word) => !queryTokens.some((token) => word.includes(token) || token.includes(word)));
  if (extra.includes("chocolate") || extra.includes("ice") || extra.includes("baby") || extra.includes("pet")) {
    score -= 0.35;
  }

  if (quantity) {
    const wanted = parseQuantity(quantity);
    const pack = parseQuantity(product.packSize.replace(/approx\.?/i, "").trim());
    if (wanted && pack && wanted.unit === pack.unit) {
      const ratio = pack.value / wanted.value;
      if (ratio >= 0.6 && ratio <= 1.6) score += 0.12;
      else if (ratio > 3 || ratio < 0.25) score -= 0.08;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function rankMatches(
  query: string,
  products: Array<Omit<PricedProduct, "confidence">>,
  quantity?: string,
  limit = 6,
): PricedProduct[] {
  return products
    .map((product) => ({
      ...product,
      confidence: scoreProduct(query, product, quantity),
    }))
    .filter((product) => product.price != null && product.confidence >= 0.22)
    .sort((a, b) => b.confidence - a.confidence || (a.price ?? 99) - (b.price ?? 99))
    .slice(0, limit);
}

export function isWeakMatch(product: PricedProduct | null | undefined): boolean {
  return !product || product.confidence < 0.55;
}
