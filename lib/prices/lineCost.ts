import { parseQuantity } from "@/lib/quantity";
import type { PricedProduct } from "./types";

export type LineCost = {
  amount: number;
  scaled: boolean;
  note?: string;
};

export function estimateLineCost(product: PricedProduct, requestedQty: string): LineCost | null {
  if (product.price == null) return null;

  const wanted = parseQuantity(requestedQty);
  const pack = parseQuantity(product.packSize.replace(/approx\.?/i, "").replace(/each/i, "").trim());

  if (wanted && pack && wanted.unit === pack.unit && pack.value > 0) {
    const ratio = wanted.value / pack.value;
    if (product.weighted || /approx/i.test(product.packSize) || ratio > 1.15) {
      const packs = ratio > 1.15 && !product.weighted ? Math.ceil(ratio) : ratio;
      const amount = Math.round(product.price * packs * 100) / 100;
      if (Math.abs(ratio - 1) > 0.12) {
        return {
          amount,
          scaled: true,
          note: product.weighted || /approx/i.test(product.packSize)
            ? `Scaled from ${product.packSize} toward ${requestedQty}`
            : `${packs} × ${product.packSize} to cover ${requestedQty}`,
        };
      }
    }
  }

  if (wanted && wanted.unit === "item" && wanted.value > 1 && (!pack || pack.unit === "item")) {
    const per = pack && pack.value > 1 ? wanted.value / pack.value : wanted.value;
    if (per > 1.05) {
      const packs = Math.ceil(per);
      return {
        amount: Math.round(product.price * packs * 100) / 100,
        scaled: true,
        note: `${packs} pack${packs === 1 ? "" : "s"} for ${requestedQty}`,
      };
    }
  }

  return { amount: product.price, scaled: false };
}

export function formatAud(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}
