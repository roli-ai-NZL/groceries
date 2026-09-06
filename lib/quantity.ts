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
  punnet: "punnet",
  punnets: "punnet",
  bag: "bag",
  bags: "bag",
  tub: "tub",
  tubs: "tub",
  block: "block",
  blocks: "block",
  wedge: "wedge",
  wedges: "wedge",
  bottle: "bottle",
  bottles: "bottle",
  carton: "carton",
  cartons: "carton",
  dozen: "dozen",
  doz: "dozen",
};

const COMPATIBLE: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
};

const SPACED_UNITS = new Set([
  "cup",
  "bunch",
  "clove",
  "pack",
  "loaf",
  "tin",
  "jar",
  "piece",
  "dozen",
  "punnet",
  "bag",
  "tub",
  "block",
  "wedge",
  "bottle",
  "carton",
]);

export type ParsedQuantity = {
  value: number;
  unit: string;
  approx: boolean;
};

export type QuantityFields = {
  count: number;
  unit: string;
  quantity: string;
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

  const timesMeasure = /^(\d+)\s*[x×]\s+(.+)$/i.exec(cleaned);
  if (timesMeasure) {
    const inner = parseQuantity(timesMeasure[2]);
    if (inner) {
      return {
        ...inner,
        value: inner.value * Number(timesMeasure[1]),
        approx: approx || inner.approx,
      };
    }
  }

  const countMatch = /^(?:[x×]\s*)?(\d+(?:\.\d+)?)(?:\s*[x×])?$/i.exec(cleaned);
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
    return parsed.value === 1 ? `${prefix}1` : `${prefix}x${formatNumber(parsed.value)}`;
  }
  return `${prefix}${formatNumber(parsed.value)}${SPACED_UNITS.has(parsed.unit) ? ` ${parsed.unit}` : parsed.unit}`;
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

export function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

export function splitQuantity(input: string): { count: number; unit: string } {
  const raw = input.trim();
  if (!raw) return { count: 1, unit: "" };
  if (/\s\+\s/.test(raw)) return { count: 1, unit: raw };

  const timesPrefix = /^(?:[x×]\s*)(\d+)\s*(.*)$/i.exec(raw);
  if (timesPrefix) {
    return {
      count: clampCount(Number(timesPrefix[1])),
      unit: timesPrefix[2].replace(/^[x×]\s*/, "").trim(),
    };
  }

  const timesMid = /^(\d+)\s*[x×]\s*(.+)$/i.exec(raw);
  if (timesMid) {
    return { count: clampCount(Number(timesMid[1])), unit: timesMid[2].trim() };
  }

  const timesOnly = /^(\d+)\s*[x×]$/i.exec(raw);
  if (timesOnly) return { count: clampCount(Number(timesOnly[1])), unit: "" };

  if (/^\d+$/.test(raw)) return { count: clampCount(Number(raw)), unit: "" };

  const countUnit = /^(\d+)\s+([^\d].*)$/.exec(raw);
  if (countUnit) {
    return { count: clampCount(Number(countUnit[1])), unit: countUnit[2].trim() };
  }

  return { count: 1, unit: raw };
}

export function formatDisplayQuantity(count: number, unit: string): string {
  const n = clampCount(count);
  const u = unit.trim();
  if (!u) return n === 1 ? "1" : `${n}×`;
  if (/^~?\d/.test(u)) return n === 1 ? u : `${n}× ${u}`;
  if (/^(kg|g|l|ml)$/i.test(u)) return `${n}${u.toLowerCase()}`;
  return `${n} ${u}`;
}

export function effectiveQuantity(count: number, unit: string): string {
  const n = clampCount(count);
  const u = unit.trim();
  if (!u) {
    return formatQuantity({ value: n, unit: "item", approx: false });
  }
  const parsed = parseQuantity(u);
  if (parsed && parsed.unit !== "item") {
    return formatQuantity({ ...parsed, value: parsed.value * n });
  }
  const asWhole = parseQuantity(formatDisplayQuantity(n, u));
  if (asWhole) return formatQuantity(asWhole);
  return formatDisplayQuantity(n, u);
}

function normalizeUnitKey(unit: string): string {
  const trimmed = unit.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return UNIT_ALIASES[trimmed] ?? trimmed.replace(/\s+/g, "");
}

export function quantityFieldsFrom(
  input: { count?: number; unit?: string; quantity?: string } = {},
  patch: { count?: number; unit?: string; quantity?: string } = {},
): QuantityFields {
  if (patch.quantity != null && patch.count == null && patch.unit == null) {
    const split = splitQuantity(patch.quantity);
    return {
      count: split.count,
      unit: split.unit,
      quantity: formatDisplayQuantity(split.count, split.unit),
    };
  }

  const hasStructured =
    patch.count != null || patch.unit != null || input.count != null || input.unit != null;

  if (hasStructured) {
    const count = clampCount(patch.count ?? input.count ?? 1);
    const unit = (patch.unit ?? input.unit ?? "").trim();
    return { count, unit, quantity: formatDisplayQuantity(count, unit) };
  }

  const split = splitQuantity(input.quantity ?? "1");
  return {
    count: split.count,
    unit: split.unit,
    quantity: formatDisplayQuantity(split.count, split.unit),
  };
}

export function withQuantityFields<T extends { count?: number; unit?: string; quantity?: string }>(
  item: T,
): T & QuantityFields {
  return { ...item, ...quantityFieldsFrom(item) };
}

export function applyQuantityPatch<T extends { count?: number; unit?: string; quantity?: string }>(
  item: T,
  patch: Partial<T>,
): T & QuantityFields {
  const fields = quantityFieldsFrom(item, {
    count: patch.count,
    unit: patch.unit,
    quantity: patch.quantity,
  });
  return { ...item, ...patch, ...fields };
}

export function combineItemQuantities(
  a: { count?: number; unit?: string; quantity?: string },
  b: { count?: number; unit?: string; quantity?: string },
): QuantityFields {
  const left = quantityFieldsFrom(a);
  const right = quantityFieldsFrom(b);
  if (normalizeUnitKey(left.unit) === normalizeUnitKey(right.unit)) {
    const count = left.count + right.count;
    const unit = left.unit || right.unit;
    return { count, unit, quantity: formatDisplayQuantity(count, unit) };
  }
  return quantityFieldsFrom({
    quantity: combineQuantities(
      effectiveQuantity(left.count, left.unit),
      effectiveQuantity(right.count, right.unit),
    ),
  });
}

export function itemDisplayQuantity(item: {
  count?: number;
  unit?: string;
  quantity?: string;
}): string {
  return quantityFieldsFrom(item).quantity;
}

export function itemSearchQuantity(item: {
  count?: number;
  unit?: string;
  quantity?: string;
}): string {
  const fields = quantityFieldsFrom(item);
  return effectiveQuantity(fields.count, fields.unit);
}
