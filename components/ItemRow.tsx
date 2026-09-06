"use client";

import { useState } from "react";
import { quantityFieldsFrom } from "@/lib/quantity";
import { CATEGORIES, STORES, type Category, type GroceryItem } from "@/lib/types";
import { QuantityStepper } from "./QuantityStepper";
import { TrashIcon } from "./icons";

type ItemRowProps = {
  item: GroceryItem;
  onChange: (id: string, patch: Partial<GroceryItem>) => void;
  onDelete: (id: string) => void;
};

const CATEGORY_HINT: Partial<Record<Category, string>> = {
  Meat: "bg-clay/15 text-clay",
  Produce: "bg-sage-soft text-sage",
  Fridge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  Bread: "bg-gold/20 text-gold",
  Pantry: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  "Every few weeks": "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  Monthly: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
};

export function ItemRow({ item, onChange, onDelete }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const optional = item.source === "occasional" || item.source === "monthly";
  const fields = quantityFieldsFrom(item);

  return (
    <li
      className={`rounded-2xl border border-line bg-card p-3 ${
        !item.included ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.checked}
          disabled={!item.included}
          onChange={(event) => onChange(item.id, { checked: event.target.checked })}
          className="mt-1 h-5 w-5 accent-sage"
          aria-label={`${item.checked ? "Uncheck" : "Check off"} ${item.name}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={`font-medium ${item.checked ? "text-muted line-through" : ""}`}>
                  {item.name}
                </span>
                {fields.unit ? (
                  <span className="text-sm text-muted">{fields.unit}</span>
                ) : null}
                {item.recipeName ? (
                  <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px] text-sage">
                    {item.recipeName}
                  </span>
                ) : null}
              </div>
              {item.note ? <p className="mt-1 text-xs leading-5 text-muted">{item.note}</p> : null}
            </div>
            <QuantityStepper
              count={fields.count}
              itemName={item.name}
              disabled={!item.included}
              onChange={(count) => onChange(item.id, { count })}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {optional ? (
              <label className="inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={item.included}
                  onChange={(event) =>
                    onChange(item.id, { included: event.target.checked, checked: false })
                  }
                />
                Include this week
              </label>
            ) : null}
            <div className="inline-flex rounded-full border border-line p-0.5 text-[11px]">
              {STORES.map((store) => (
                <button
                  key={store}
                  type="button"
                  onClick={() => onChange(item.id, { store })}
                  className={`rounded-full px-2.5 py-1 ${
                    item.store === store
                      ? store === "Coles"
                        ? "bg-coles text-white"
                        : store === "Woolworths"
                          ? "bg-woolies text-white"
                          : "bg-ink text-paper"
                      : "text-muted"
                  }`}
                >
                  {store === "Woolworths" ? "Woolies" : store}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="text-xs font-medium text-sage"
            >
              {editing ? "Close" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="ml-auto text-muted hover:text-clay"
              aria-label={`Delete ${item.name}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          {editing ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_9rem]">
              <input
                value={item.name}
                onChange={(event) => onChange(item.id, { name: event.target.value })}
                aria-label="Item name"
                className="h-10 rounded-xl border border-line bg-paper px-3 text-sm"
              />
              <input
                value={fields.unit}
                onChange={(event) => onChange(item.id, { unit: event.target.value })}
                placeholder="kg, punnet, 1.4kg"
                aria-label="Unit or pack size"
                className="h-10 rounded-xl border border-line bg-paper px-3 text-sm"
              />
              <select
                value={item.category}
                onChange={(event) =>
                  onChange(item.id, { category: event.target.value as Category })
                }
                aria-label="Category"
                className="h-10 rounded-xl border border-line bg-paper px-3 text-sm"
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <input
                value={item.note ?? ""}
                onChange={(event) => onChange(item.id, { note: event.target.value })}
                placeholder="Note"
                aria-label="Note"
                className="h-10 rounded-xl border border-line bg-paper px-3 text-sm sm:col-span-3"
              />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function categoryChipClass(category: Category) {
  return CATEGORY_HINT[category] ?? "bg-paper-deep text-muted";
}
