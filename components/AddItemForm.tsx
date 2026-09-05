"use client";

import { FormEvent, useState } from "react";
import { CATEGORIES, STORES, type Category, type StorePreference } from "@/lib/types";
import { PlusIcon } from "./icons";

type AddItemFormProps = {
  onAdd: (item: {
    name: string;
    quantity: string;
    category: Category;
    store: StorePreference;
  }) => void;
};

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState<Category>("Other");
  const [store, setStore] = useState<StorePreference>("Either");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), quantity: quantity.trim() || "1", category, store });
    setName("");
    setQuantity("1");
    setOpen(false);
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
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_9rem_8rem_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Item name"
          aria-label="Item name"
          autoFocus
          className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
        />
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Qty"
          aria-label="Quantity"
          className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"
        />
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
            onClick={() => setOpen(false)}
            className="h-11 rounded-xl border border-line px-3 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
