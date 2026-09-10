"use client";

import { useMemo, useRef, useState } from "react";
import { AddItemForm } from "./AddItemForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { ItemRow, categoryChipClass } from "./ItemRow";
import { EstimateBill } from "./EstimateBill";
import { FillCarts } from "./FillCarts";
import { OrderPrep } from "./OrderPrep";
import { RecipeReview } from "./RecipeReview";
import { RecipeSearch } from "./RecipeSearch";
import { ThemeToggle } from "./ThemeToggle";
import { CartIcon, DownloadIcon, ReceiptIcon, RefreshIcon } from "./icons";
import { createId } from "@/lib/id";
import { mergeRecipeIngredients } from "@/lib/merge";
import { applyQuantityPatch } from "@/lib/quantity";
import { exportState, importState } from "@/lib/storage";
import { PASTA_NOTE, resetToStaples } from "@/lib/staples";
import { CATEGORIES, type Category, type GroceryItem, type RecipeIngredient, type RecipeMatch } from "@/lib/types";
import { useGroceryState } from "@/lib/useGroceryState";
import { sydneyTodayLabel, sydneyWeekLabel } from "@/lib/week";

export function GroceryApp() {
  const [items, setItems] = useGroceryState();
  const [hideChecked, setHideChecked] = useState(false);
  const [recipe, setRecipe] = useState<RecipeMatch | null>(null);
  const [recipeNotice, setRecipeNotice] = useState("");
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [fillCartsOpen, setFillCartsOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  const visible = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      items: items.filter((item) => {
        if (item.category !== category) return false;
        if (hideChecked && item.checked && item.included) return false;
        return true;
      }),
    })).filter((group) => group.items.length);
  }, [items, hideChecked]);

  const selected = items.filter((item) => item.checked).length;
  const listed = items.filter((item) => item.included).length;

  function updateItem(id: string, patch: Partial<GroceryItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? applyQuantityPatch(item, patch) : item)),
    );
  }

  function pickRecipe(match: RecipeMatch, notice?: string) {
    setRecipe(match);
    setRecipeNotice(notice ?? "");
    setDraftIngredients(match.ingredients.map((item) => ({ ...item })));
  }

  return (
    <div className="relative min-h-full">
      <div className="grain" />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Sydney · personal dashboard</p>
            <h1 className="font-display mt-1 text-4xl leading-none sm:text-5xl">Roland&apos;s groceries</h1>
            <p className="mt-2 text-sm text-muted">
              Week of {sydneyWeekLabel()} · {sydneyTodayLabel()}
            </p>
          </div>
          <ThemeToggle />
        </header>

        <RecipeSearch onPick={pickRecipe} />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{selected} selected</span>
            {` · ${listed} on the list`}
          </p>
          <div className="flex flex-wrap gap-2">
            <AddItemForm
              onAdd={(item) => {
                setItems((current) => [
                  ...current,
                  {
                    ...item,
                    id: createId("custom"),
                    checked: false,
                    included: true,
                    source: "custom",
                  },
                ]);
              }}
            />
            <button
              type="button"
              onClick={() => setHideChecked((value) => !value)}
              className="h-10 rounded-full border border-line bg-card px-4 text-sm"
            >
              {hideChecked ? "Show selected" : "Hide selected"}
            </button>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm"
            >
              <RefreshIcon className="h-4 w-4" />
              Reset week
            </button>
            <button
              type="button"
              onClick={() => setEstimateOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium"
            >
              <ReceiptIcon className="h-4 w-4" />
              Estimate bill
            </button>
            <button
              type="button"
              onClick={() => setOrderOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium"
            >
              <CartIcon className="h-4 w-4" />
              Prepare Coles / Woolies order
            </button>
            <button
              type="button"
              onClick={() => setFillCartsOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper"
            >
              <CartIcon className="h-4 w-4" />
              Fill Coles / Woolies carts
            </button>
          </div>
        </section>

        {visible.length === 0 ? (
          <div className="paper-card rounded-3xl px-6 py-14 text-center">
            <p className="font-display text-2xl">The list is empty</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Add an item, search a recipe, or reset the week to reload Roland&apos;s standing staples.
            </p>
            <button
              type="button"
              onClick={() => setItems(resetToStaples([]))}
              className="mt-5 rounded-full bg-sage px-4 py-2.5 text-sm font-semibold text-white"
            >
              Reload staples
            </button>
          </div>
        ) : (
          visible.map((group) => (
            <CategorySection
              key={group.category}
              category={group.category}
              items={group.items}
              onChange={updateItem}
              onDelete={(id) => setItems((current) => current.filter((item) => item.id !== id))}
            />
          ))
        )}

        <footer className="no-print mt-2 flex flex-col gap-3 border-t border-line pt-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Saved on this device. No login — export a backup if you switch browsers.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([exportState(items)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "roland-groceries-backup.json";
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2"
            >
              <DownloadIcon className="h-4 w-4" />
              Export list
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="rounded-full border border-line px-3 py-2"
            >
              Import list
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  setItems(importState(await file.text()));
                  flash("List imported.");
                } catch (error) {
                  flash(error instanceof Error ? error.message : "Couldn’t import that file.");
                }
              }}
            />
          </div>
        </footer>
      </div>

      {recipe ? (
        <RecipeReview
          recipe={recipe}
          notice={recipeNotice}
          ingredients={draftIngredients}
          onChange={setDraftIngredients}
          onClose={() => setRecipe(null)}
          onMerge={() => {
            setItems((current) => mergeRecipeIngredients(current, draftIngredients, recipe.name));
            setRecipe(null);
            flash(`Merged ${recipe.name} into this week.`);
          }}
        />
      ) : null}

      {orderOpen ? <OrderPrep items={items} onClose={() => setOrderOpen(false)} /> : null}
      {fillCartsOpen ? <FillCarts items={items} onClose={() => setFillCartsOpen(false)} /> : null}
      {estimateOpen ? <EstimateBill items={items} onClose={() => setEstimateOpen(false)} /> : null}

      {resetOpen ? (
        <ConfirmDialog
          title="Reset this week?"
          description="Weekly staples reload from the standing Sydney list. Recipe and custom weekly items are cleared. Every-few-weeks and monthly toggles (and store prefs) stay as they are."
          confirmLabel="Reset week"
          danger
          onClose={() => setResetOpen(false)}
          onConfirm={() => {
            setItems((current) => resetToStaples(current));
            setResetOpen(false);
            flash("Week reset to standing staples.");
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-card"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function CategorySection({
  category,
  items,
  onChange,
  onDelete,
}: {
  category: Category;
  items: GroceryItem[];
  onChange: (id: string, patch: Partial<GroceryItem>) => void;
  onDelete: (id: string) => void;
}) {
  const showPastaNote =
    category === "Pantry" ||
    (category === "Monthly" && items.some((item) => /tomato paste|dolmio|pasta sauce/i.test(item.name)));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <span className={`rounded-full px-2.5 py-1 text-xs font-sans font-semibold ${categoryChipClass(category)}`}>
            {items.filter((item) => item.checked).length}
          </span>
          {category}
        </h2>
        {category === "Every few weeks" || category === "Monthly" ? (
          <p className="text-xs text-muted">Optional this week — toggle include on each item.</p>
        ) : null}
      </div>
      {showPastaNote && category === "Pantry" ? (
        <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm leading-6">{PASTA_NOTE}</p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} onChange={onChange} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}
