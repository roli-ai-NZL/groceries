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

const PROTEINS = new Set([
  "beef",
  "pork",
  "chicken",
  "lamb",
  "turkey",
  "duck",
  "veal",
  "fish",
  "salmon",
  "tuna",
  "prawn",
  "prawns",
  "shrimp",
  "kangaroo",
]);

const PRODUCT_KEYS = new Set(["bacon", "ham"]);

const CUT_CANON: Record<string, string> = {
  mince: "mince",
  minced: "mince",
  ground: "mince",
  breast: "breast",
  breasts: "breast",
  thigh: "thigh",
  thighs: "thigh",
  diced: "diced",
  cube: "diced",
  cubes: "diced",
  steak: "steak",
  steaks: "steak",
  chop: "chop",
  chops: "chop",
  wing: "wing",
  wings: "wing",
  drumstick: "drumstick",
  drumsticks: "drumstick",
  fillet: "fillet",
  fillets: "fillet",
  tenderloin: "fillet",
  brisket: "brisket",
  rib: "ribs",
  ribs: "ribs",
  sausage: "sausage",
  sausages: "sausage",
};

/** Cuts that should not beat the query cut when both are present. Complementary words like "fillet" are omitted. */
const CUT_CONFLICTS: Record<string, ReadonlySet<string>> = {
  mince: new Set(["diced", "steak", "sausage", "breast", "thigh", "chop"]),
  diced: new Set(["mince", "steak", "sausage", "breast"]),
  breast: new Set(["thigh", "wing", "drumstick", "mince", "sausage", "diced"]),
  thigh: new Set(["breast", "wing", "drumstick", "mince", "sausage", "diced"]),
  steak: new Set(["mince", "diced", "sausage"]),
  sausage: new Set(["mince", "diced", "breast", "steak"]),
  wing: new Set(["breast", "thigh", "drumstick"]),
  drumstick: new Set(["breast", "thigh", "wing"]),
};

const PREPARED_WORDS = new Set([
  "ready",
  "meal",
  "meals",
  "kit",
  "kits",
  "flavoured",
  "flavored",
  "flavour",
  "flavor",
  "crumbed",
  "crumbed",
  "southern",
  "fried",
  "marinated",
  "seasoned",
  "kiev",
  "schnitzel",
  "nugget",
  "nuggets",
  "tenders",
  "stirfry",
  "casserole",
  "ragu",
  "bolognese",
  "curry",
  "pie",
  "pies",
  "honey",
  "smoky",
  "chilli",
  "chili",
  "peri",
  "bbq",
  "teriyaki",
  "satay",
  "tempura",
  "recipe",
  "dinner",
  "kitchen",
]);

const PRIVATE_LABEL = /\b(coles|woolworths|woolies|macro|essentials|homebrand|select)\b/i;

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

function proteinSet(words: string[]): Set<string> {
  return new Set(words.filter((word) => PROTEINS.has(word)));
}

function productKeySet(words: string[]): Set<string> {
  return new Set(words.filter((word) => PRODUCT_KEYS.has(word)));
}

function cutSet(words: string[]): Set<string> {
  const cuts = new Set<string>();
  for (const word of words) {
    const canon = CUT_CANON[word];
    if (canon) cuts.add(canon);
  }
  return cuts;
}

function isStapleQuery(queryTokens: string[]): boolean {
  if (queryTokens.some((token) => PREPARED_WORDS.has(token))) return false;
  return (
    queryTokens.some((token) => PROTEINS.has(token)) ||
    queryTokens.some((token) => PRODUCT_KEYS.has(token)) ||
    queryTokens.some((token) => Boolean(CUT_CANON[token]))
  );
}

function preparedPenalty(name: string, queryTokens: string[]): number {
  if (!isStapleQuery(queryTokens)) return 0;
  const lower = name.toLowerCase();
  let penalty = 0;
  if (/made easy|meal kit|ready meal|dinner kit|recipe kit/.test(lower)) penalty += 0.34;
  if (/crumbed|southern fried|marinated|tempura|kiev|schnitzel|nugget/.test(lower)) penalty += 0.3;
  if (/flavou?r|honey|smoky|teriyaki|satay|peri peri|\bbbq\b|stir[\s-]?fry/.test(lower)) penalty += 0.18;
  const extras = tokens(name).filter((word) => PREPARED_WORDS.has(word));
  if (extras.length) penalty += Math.min(0.16, extras.length * 0.08);
  return Math.min(penalty, 0.55);
}

function identityFit(queryTokens: string[], hay: string[]): { score: number; rank: number } {
  const qProteins = proteinSet(queryTokens);
  const pProteins = proteinSet(hay);
  const qKeys = productKeySet(queryTokens);
  const pKeys = productKeySet(hay);
  const qCuts = cutSet(queryTokens);
  const pCuts = cutSet(hay);

  let score = 0;
  let rank = 0;

  if (qProteins.size) {
    let matched = 0;
    for (const protein of qProteins) {
      if (pProteins.has(protein)) matched += 1;
    }
    if (matched === 0) {
      score -= 0.28;
      rank -= 2;
    } else {
      score += 0.2;
      rank += 2;
    }
    for (const protein of pProteins) {
      if (!qProteins.has(protein)) {
        score -= 0.22;
        rank -= 2;
      }
    }
  }

  if (qKeys.size) {
    let matched = 0;
    for (const key of qKeys) {
      if (pKeys.has(key)) matched += 1;
    }
    if (matched === 0) {
      score -= 0.32;
      rank -= 2;
    } else {
      score += 0.22;
      rank += 2;
    }
  }

  if (qCuts.size) {
    let matched = 0;
    for (const cut of qCuts) {
      if (pCuts.has(cut)) matched += 1;
    }
    if (matched === 0) {
      score -= 0.28;
      rank -= 1;
    } else {
      score += 0.14;
      rank += 1;
    }
    for (const cut of pCuts) {
      if (qCuts.has(cut)) continue;
      const conflicts = [...qCuts].some((wanted) => CUT_CONFLICTS[wanted]?.has(cut));
      if (conflicts) {
        score -= 0.22;
        rank -= 1;
      }
    }
  }

  return { score, rank };
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

  const identity = identityFit(queryTokens, hay);
  score += identity.score;
  score -= preparedPenalty(`${product.brand ?? ""} ${product.name}`, queryTokens);

  if (isStapleQuery(queryTokens)) {
    const extraNoise = extra.filter(
      (word) => !PROTEINS.has(word) && !PRODUCT_KEYS.has(word) && !CUT_CANON[word] && !/^\d/.test(word),
    );
    if (extraNoise.length <= 1) score += 0.08;
    if (PRIVATE_LABEL.test(`${product.brand ?? ""} ${product.name}`)) score += 0.04;
  }

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

  return score;
}

function rankKey(
  query: string,
  product: Omit<PricedProduct, "confidence">,
): number {
  return identityFit(tokens(query), tokens(`${product.brand ?? ""} ${product.name} ${product.packSize}`)).rank;
}

export function rankMatches(
  query: string,
  products: Array<Omit<PricedProduct, "confidence">>,
  quantity?: string,
  category?: string,
  limit = 6,
): PricedProduct[] {
  return products
    .map((product) => {
      const raw = scoreProduct(query, product, quantity, category);
      return {
        ...product,
        confidence: Math.max(0, Math.min(1, raw)),
        raw,
        identityRank: rankKey(query, product),
      };
    })
    .filter((product) => product.price != null && product.confidence >= 0.22)
    .sort((a, b) => {
      if (a.identityRank !== b.identityRank) return b.identityRank - a.identityRank;
      const diff = b.raw - a.raw;
      if (Math.abs(diff) > 0.04) return diff;
      return (a.price ?? 99) - (b.price ?? 99);
    })
    .slice(0, limit)
    .map((product) => {
      const priced: PricedProduct = { ...product };
      delete (priced as PricedProduct & { raw?: number }).raw;
      delete (priced as PricedProduct & { identityRank?: number }).identityRank;
      return priced;
    });
}

export function isWeakMatch(product: PricedProduct | null | undefined): boolean {
  return !product || product.confidence < 0.55;
}
