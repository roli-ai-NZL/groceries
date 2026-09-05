"use client";

import { FormEvent, useState } from "react";
import type { RecipeMatch } from "@/lib/types";
import { SearchIcon } from "./icons";

type RecipeSearchProps = {
  onPick: (recipe: RecipeMatch, notice?: string) => void;
};

export function RecipeSearch({ onPick }: RecipeSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<RecipeMatch[]>([]);
  const [notice, setNotice] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) {
      setError("Type a recipe name — not a full recipe.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    setMatches([]);

    try {
      const response = await fetch(`/api/recipes?q=${encodeURIComponent(q)}`);
      const data = (await response.json()) as {
        meals?: RecipeMatch[];
        notice?: string;
        error?: string;
      };
      if (!response.ok || !data.meals?.length) {
        throw new Error(data.error || "Couldn't find a typical version of that recipe.");
      }
      setNotice(data.notice ?? "");
      if (data.meals.length === 1) {
        onPick(data.meals[0], data.notice);
        setQuery("");
        return;
      }
      setMatches(data.meals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recipe lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="paper-card rounded-3xl p-4 sm:p-5">
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="recipe-search">
          Search by recipe name
        </label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            id="recipe-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add a recipe by name — bolognese, carbonara, tacos…"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-line bg-paper px-11 text-base text-ink placeholder:text-muted/80"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-2xl bg-sage px-5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {loading ? "Looking up…" : "Find ingredients"}
        </button>
      </form>
      <p className="mt-2 text-xs leading-5 text-muted">
        Looks up a typical / generic version of the dish. You’ll review quantities before anything
        joins this week’s list.
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-2xl bg-clay/10 px-3 py-2 text-sm text-clay">
          {error}
        </p>
      ) : null}
      {notice && matches.length > 1 ? (
        <p className="mt-3 text-sm text-muted">{notice}</p>
      ) : null}
      {matches.length > 1 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {matches.map((meal) => (
            <li key={meal.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(meal, notice);
                  setMatches([]);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper p-3 text-left hover:border-sage"
              >
                {meal.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meal.thumbnail}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-sage-soft" />
                )}
                <span>
                  <span className="block font-medium">{meal.name}</span>
                  <span className="text-xs text-muted">
                    {[meal.area, meal.category, meal.sourceLabel].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
