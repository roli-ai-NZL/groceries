"use client";

import { FormEvent, useState } from "react";
import { quantityFieldsFrom } from "@/lib/quantity";
import { CATEGORIES, STORES, type Category, type StorePreference } from "@/lib/types";
import { PlusIcon } from "./icons";
import { QuantityStepper } from "./QuantityStepper";

type AddItemFormProps = {
  onAdd: (item: {
    name: string;
    quantity: string;
    count: number;
    unit: string;
    category: Category;
    store: StorePreference;
  }) => void;
};

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [store, setStore] = useState<StorePreference>("Either");

  function reset() {
    setName("");
    setCount(1);
    setUnit("");
    setOpen(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const fields = quantityFieldsFrom({ count, unit });
    onAdd({
      name: name.trim(),
      ...fields,
      category,
      store,
    });
    reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium"
      >
        <PlusIcon className="h-4 w-4" />
        Add item
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="paper-card w-full rounded-3xl p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_8rem]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Item name"
          aria-label="Item name"
          autoFocus
          className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
        />
        <QuantityStepper count={count} onChange={setCount} itemName={name || "new item"} />
        <input
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="kg, punnet, 1.4kg"
          aria-label="Unit or pack size"
          className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
        />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          aria-label="Category"
          className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
        >
          {CATEGORIES.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <select
          value={store}
          onChange={(event) => setStore(event.target.value as StorePreference)}
          aria-label="Store preference"
          className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
        >
          {STORES.map((option) => (
            <option key={option} value={option}>
              {option === "Woolworths" ? "Woolies" : option}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="h-11 rounded-xl bg-sage px-4 text-sm font-semibold text-white">
            Add
          </button>
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-xl border border-line px-3 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
