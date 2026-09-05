const UNIT_ALIASES: Record<string, string> = {
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  kg: "kg",
  gram: "g",
  grams: "g",
  g: "g",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  l: "l",
  millilitre: "ml",
  millilitres: "ml",
  milliliter: "ml",
  milliliters: "ml",
  ml: "ml",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  cup: "cup",
  cups: "cup",
  bunch: "bunch",
  bunches: "bunch",
  clove: "clove",
  cloves: "clove",
  pack: "pack",
  packs: "pack",
  packet: "pack",
  pkt: "pack",
  loaf: "loaf",
  loaves: "loaf",
  tin: "tin",
  tins: "tin",
  can: "tin",
  cans: "tin",
  jar: "jar",
  jars: "jar",
  piece: "piece",
  pieces: "piece",
  item: "item",
  items: "item",
  x: "item",
};

const COMPATIBLE: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
};

export type ParsedQuantity = {
  value: number;
  unit: string;
  approx: boolean;
};

function parseNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[½]/g, " 1/2 ")
    .replace(/[¼]/g, " 1/4 ")
    .replace(/[¾]/g, " 3/4 ")
    .replace(/[⅓]/g, " 1/3 ")
    .replace(/[⅔]/g, " 2/3 ")
    .replace(/-/g, " ")
    .trim();

  const bits = cleaned.split(/\s+/).filter(Boolean);
  let total = 0;
  let matched = false;

  for (const bit of bits) {
    if (/^\d+\/\d+$/.test(bit)) {
      const [n, d] = bit.split("/").map(Number);
      if (!d) return null;
      total += n / d;
      matched = true;
    } else if (/^\d+(\.\d+)?$/.test(bit)) {
      total += Number(bit);
      matched = true;
    } else {
      return null;
    }
  }

  return matched ? total : null;
}

export function parseQuantity(input: string): ParsedQuantity | null {
  const raw = input.trim();
  if (!raw) return { value: 1, unit: "item", approx: false };

  const approx = /^~/.test(raw) || /\b(about|approx|approximately)\b/i.test(raw);
  const cleaned = raw
    .replace(/^~/, "")
    .replace(/\b(about|approx|approximately)\b/gi, "")
    .trim();

  const countMatch = /^(?:x\s*)?(\d+(?:\.\d+)?)(?:\s*x)?$/i.exec(cleaned);
  if (countMatch) {
    return { value: Number(countMatch[1]), unit: "item", approx };
  }

  const match =
    /^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*([a-zA-Z]+)?/.exec(
      cleaned,
    );
  if (!match) return null;

  const value = parseNumber(match[1]);
  if (value === null) return null;

  const unitRaw = (match[2] ?? "item").toLowerCase();
  const unit = UNIT_ALIASES[unitRaw] ?? unitRaw;
  return { value, unit, approx };
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

export function formatQuantity(parsed: ParsedQuantity): string {
  const prefix = parsed.approx ? "~" : "";
  if (parsed.unit === "item") {
    return parsed.value === 1 ? `${prefix}1`.replace(/^~1$/, "~1") : `${prefix}x${formatNumber(parsed.value)}`;
  }
  return `${prefix}${formatNumber(parsed.value)}${parsed.unit === "cup" || parsed.unit === "bunch" || parsed.unit === "clove" || parsed.unit === "pack" || parsed.unit === "loaf" || parsed.unit === "tin" || parsed.unit === "jar" || parsed.unit === "piece" ? ` ${parsed.unit}` : parsed.unit}`;
}

export function combineQuantities(a: string, b: string): string {
  const left = parseQuantity(a);
  const right = parseQuantity(b);
  if (!left || !right) {
    const parts = [a.trim(), b.trim()].filter(Boolean);
    return parts.join(" + ");
  }

  if (left.unit === right.unit) {
    return formatQuantity({
      value: left.value + right.value,
      unit: left.unit,
      approx: left.approx || right.approx,
    });
  }

  const leftBase = COMPATIBLE[left.unit];
  const rightBase = COMPATIBLE[right.unit];
  if (leftBase && rightBase && leftBase.base === rightBase.base) {
    const total = left.value * leftBase.factor + right.value * rightBase.factor;
    if (leftBase.base === "g") {
      return formatQuantity({
        value: total >= 1000 ? total / 1000 : total,
        unit: total >= 1000 ? "kg" : "g",
        approx: left.approx || right.approx,
      });
    }
    return formatQuantity({
      value: total >= 1000 ? total / 1000 : total,
      unit: total >= 1000 ? "l" : "ml",
      approx: left.approx || right.approx,
    });
  }

  return `${a.trim()} + ${b.trim()}`;
}
