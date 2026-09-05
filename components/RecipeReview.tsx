"use client";

import { useEffect, useRef } from "react";
import { CATEGORIES, type RecipeIngredient, type RecipeMatch } from "@/lib/types";
import { CloseIcon } from "./icons";

type RecipeReviewProps = {
  recipe: RecipeMatch;
  notice?: string;
  ingredients: RecipeIngredient[];
  onChange: (ingredients: RecipeIngredient[]) => void;
  onClose: () => void;
  onMerge: () => void;
};

export function RecipeReview({
  recipe,
  notice,
  ingredients,
  onChange,
  onClose,
  onMerge,
}: RecipeReviewProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const keep = ingredients.filter((item) => !item.excluded && !item.alreadyHave);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  function update(id: string, patch: Partial<RecipeIngredient>) {
    onChange(ingredients.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close recipe review" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-review-title"
        tabIndex={-1}
        className="paper-card relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{recipe.sourceLabel}</p>
            <h2 id="recipe-review-title" className="font-display mt-1 text-2xl sm:text-3xl">
              {recipe.name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Review before merging. Mark pantry staples you already have, tweak quantities, or drop
              lines.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:text-ink" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {notice ? (
          <p className="mx-5 mt-4 rounded-2xl bg-gold/15 px-3 py-2 text-sm text-ink">{notice}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-3">
            {ingredients.map((item) => (
              <li
                key={item.id}
                className={`rounded-2xl border border-line p-3 ${
                  item.excluded || item.alreadyHave ? "opacity-55" : "bg-paper"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={item.alreadyHave}
                      onChange={(event) => update(item.id, { alreadyHave: event.target.checked })}
                    />
                    Already have
                  </label>
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_7rem_8rem]">
                    <input
                      value={item.name}
                      aria-label="Ingredient name"
                      onChange={(event) => update(item.id, { name: event.target.value })}
                      className="rounded-xl border border-line bg-card px-3 py-2 text-sm"
                    />
                    <input
                      value={item.quantity}
                      aria-label="Quantity"
                      onChange={(event) => update(item.id, { quantity: event.target.value })}
                      className="rounded-xl border border-line bg-card px-3 py-2 text-sm"
                    />
                    <select
                      value={item.category}
                      aria-label="Category"
                      onChange={(event) =>
                        update(item.id, {
                          category: event.target.value as RecipeIngredient["category"],
                        })
                      }
                      className="rounded-xl border border-line bg-card px-3 py-2 text-sm"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => update(item.id, { excluded: !item.excluded })}
                    className="text-sm text-clay"
                  >
                    {item.excluded ? "Restore" : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-t border-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {keep.length} ingredient{keep.length === 1 ? "" : "s"} will merge into this week.
            Matching names combine quantities when obvious.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={onMerge}
              disabled={!keep.length}
              className="rounded-full bg-sage px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Merge into list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
