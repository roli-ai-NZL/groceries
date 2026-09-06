import { quantityFieldsFrom } from "./quantity";
import { CATEGORIES, STORES, type GroceryItem, type ShoppingPayload } from "./types";

export const AGENT_INSTRUCTIONS =
  "This payload is for an external shopping agent to add items to a Coles and/or Woolworths cart only. Roland reviews substitutions and specials, then completes checkout and payment himself. Do not log in as Roland or pay.";

export function shoppingItems(items: GroceryItem[]) {
  return items.filter((item) => item.included && !item.checked);
}

export function buildShoppingPayload(items: GroceryItem[]): ShoppingPayload {
  const ready = shoppingItems(items).map((item) => {
    const fields = quantityFieldsFrom(item);
    return {
      name: item.name,
      quantity: fields.quantity,
      count: fields.count,
      unit: fields.unit || undefined,
      category: item.category,
      store: item.store,
      note: item.note,
    };
  });

  const byCategory: ShoppingPayload["byCategory"] = {};
  for (const category of CATEGORIES) {
    const group = ready.filter((item) => item.category === category);
    if (group.length) byCategory[category] = group;
  }

  const byStore: ShoppingPayload["byStore"] = {};
  for (const store of STORES) {
    const group = ready.filter((item) => item.store === store);
    if (group.length) byStore[store] = group;
  }

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

export function formatShoppingList(payload: ShoppingPayload): string {
  const lines = [
    `Roland's weekly shop — ${payload.itemCount} items`,
    "Sydney / Australia",
    "",
    payload.instructions,
    "",
  ];

  for (const [category, items] of Object.entries(payload.byCategory)) {
    lines.push(category.toUpperCase());
    for (const item of items) {
      const store = item.store === "Either" ? "" : ` · ${item.store}`;
      const note = item.note ? ` — ${item.note}` : "";
      lines.push(`- ${item.name} — ${item.quantity}${store}${note}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
