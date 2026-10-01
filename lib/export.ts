import { priceCacheKey, type ClientPriceCache } from "./prices/clientCache";
import type { PricedProduct } from "./prices/types";
import { quantityFieldsFrom } from "./quantity";
import {
  CART_STORES,
  CATEGORIES,
  type CartStore,
  type GroceryItem,
  type ShoppingMatchedProduct,
  type ShoppingPayload,
  type ShoppingPayloadItem,
} from "./types";

export const AGENT_INSTRUCTIONS =
  "Add these items to a Coles and/or Woolworths trolley only. Stop before checkout and payment. Roland reviews substitutions and specials, then completes checkout himself. Do not pay or place the order.";

export const AGENT_HANDOFF_LINE = "Agent adds to trolley only — you review and checkout";

/** Checked rows — Estimate, Prepare order, and Fill carts share this selection. */
export function shoppingItems(items: GroceryItem[]) {
  return items.filter((item) => item.checked === true);
}

/** Estimate bill prices only rows Roland has checked. */
export function estimateItems(items: GroceryItem[]) {
  return shoppingItems(items);
}

export type BuildShoppingPayloadOptions = {
  estimateCache?: ClientPriceCache;
};

function compactMatch(product?: PricedProduct): ShoppingMatchedProduct | undefined {
  if (!product) return undefined;
  return {
    id: product.id,
    name: product.name,
    ...(product.url ? { url: product.url } : {}),
    ...(product.packSize ? { packSize: product.packSize } : {}),
  };
}

export function matchedProductsFromCache(
  item: GroceryItem,
  cache?: ClientPriceCache,
): ShoppingPayloadItem["matched"] | undefined {
  if (!cache) return undefined;
  const entry = cache[priceCacheKey(item)];
  if (!entry) return undefined;
  const coles = compactMatch(entry.payload.coles.matches[0]);
  const woolworths = compactMatch(entry.payload.woolworths.matches[0]);
  if (!coles && !woolworths) return undefined;
  return {
    ...(coles ? { coles } : {}),
    ...(woolworths ? { woolworths } : {}),
  };
}

function toPayloadItem(item: GroceryItem, cache?: ClientPriceCache): ShoppingPayloadItem {
  const fields = quantityFieldsFrom(item);
  const matched = matchedProductsFromCache(item, cache);
  return {
    name: item.name,
    quantity: fields.quantity,
    count: fields.count,
    unit: fields.unit || undefined,
    category: item.category,
    store: item.store,
    note: item.note,
    ...(matched ? { matched } : {}),
  };
}

export function buildShoppingPayload(
  items: GroceryItem[],
  options: BuildShoppingPayloadOptions = {},
): ShoppingPayload {
  const ready = shoppingItems(items).map((item) => toPayloadItem(item, options.estimateCache));

  const byCategory: ShoppingPayload["byCategory"] = {};
  for (const category of CATEGORIES) {
    const group = ready.filter((item) => item.category === category);
    if (group.length) byCategory[category] = group;
  }

  const byStore: ShoppingPayload["byStore"] = {
    Coles: ready.filter((item) => item.store === "Coles"),
    Woolworths: ready.filter((item) => item.store === "Woolworths"),
    Either: ready.filter((item) => item.store === "Either"),
  };

  return {
    generatedAt: new Date().toISOString(),
    timezone: "Australia/Sydney",
    shopper: "Roland",
    locale: "en-AU",
    instructions: AGENT_INSTRUCTIONS,
    itemCount: ready.length,
    items: ready,
    byCategory,
    byStore,
  };
}

export function storeCartCounts(payload: ShoppingPayload) {
  const coles = payload.byStore.Coles.length;
  const woolworths = payload.byStore.Woolworths.length;
  const either = payload.byStore.Either.length;
  return {
    coles,
    woolworths,
    either,
    total: payload.itemCount,
    /** Coles-only plus Either (agent may put Either on this trolley). */
    colesCart: coles + either,
    woolworthsCart: woolworths + either,
  };
}

function storeHeading(store: CartStore, count: number) {
  if (store === "Either") {
    return `EITHER — pick Coles or Woolworths (${count})`;
  }
  return `${store.toUpperCase()} (${count})`;
}

function formatLine(item: ShoppingPayloadItem) {
  const note = item.note ? ` — ${item.note}` : "";
  const matchHint = item.matched
    ? item.store === "Coles" && item.matched.coles
      ? ` [${item.matched.coles.name}]`
      : item.store === "Woolworths" && item.matched.woolworths
        ? ` [${item.matched.woolworths.name}]`
        : ""
    : "";
  return `- ${item.name} — ${item.quantity}${note}${matchHint}`;
}

export function formatShoppingList(payload: ShoppingPayload): string {
  const lines = [
    `Roland's weekly shop — ${payload.itemCount} checked items`,
    "Sydney / Australia / Australia/Sydney",
    "",
    AGENT_HANDOFF_LINE,
    payload.instructions,
    "",
  ];

  for (const store of CART_STORES) {
    const group = payload.byStore[store];
    lines.push(storeHeading(store, group.length));
    if (!group.length) {
      lines.push("- (none)");
    } else {
      for (const item of group) {
        lines.push(formatLine(item));
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function formatAgentBrief(payload: ShoppingPayload): string {
  const counts = storeCartCounts(payload);
  return [
    "Fill Roland's Coles and Woolworths trolleys from this grocery list.",
    "",
    "Shopper: Roland",
    "Timezone: Australia/Sydney",
    "Agent: Shappy (or any cart-filling agent)",
    `Checked items: ${counts.total}`,
    `Coles-only: ${counts.coles}`,
    `Woolworths-only: ${counts.woolworths}`,
    `Either (choose one store, do not double-add): ${counts.either}`,
    "",
    "Rules:",
    "- Log in to Coles and/or Woolworths if needed and ADD ITEMS TO THE TROLLEY ONLY.",
    "- Do not checkout, pay, or submit the order.",
    "- Stop so Roland can review substitutions and specials, then check out himself.",
    "- Coles-only → Coles trolley. Woolies-only → Woolworths trolley.",
    "- Either → pick Coles or Woolworths from price/availability. Do not add the same line to both trolleys unless asked.",
    "- Prefer matched product id/url from the JSON when present (from the last Estimate).",
    "- Use count × unit / display quantity on each line.",
    "",
    "Checklist:",
    formatShoppingList(payload).trim(),
    "",
    "Machine-readable payload:",
    JSON.stringify(payload, null, 2),
    "",
  ].join("\n");
}
