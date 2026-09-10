"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { estimateItems } from "@/lib/export";
import { itemDisplayQuantity, itemSearchQuantity } from "@/lib/quantity";
import {
  priceCacheKey,
  readClientPriceCache,
  writeClientPriceCache,
} from "@/lib/prices/clientCache";
import { estimateLineCost, formatAud } from "@/lib/prices/lineCost";
import { isWeakMatch } from "@/lib/prices/match";
import {
  ESTIMATE_DISCLAIMER,
  PRICE_CACHE_TTL_MS,
  type PriceSearchResponse,
  type PricedProduct,
} from "@/lib/prices/types";
import type { GroceryItem, StorePreference } from "@/lib/types";
import { CloseIcon, ReceiptIcon, RefreshIcon } from "./icons";

type EstimateBillProps = {
  items: GroceryItem[];
  onClose: () => void;
};

type RowState = {
  item: GroceryItem;
  loading: boolean;
  error?: string;
  coles: PricedProduct[];
  woolworths: PricedProduct[];
  colesId?: string;
  woolworthsId?: string;
  colesError?: string;
  woolworthsError?: string;
};

function pick(matches: PricedProduct[], id?: string) {
  return matches.find((product) => product.id === id) ?? matches[0] ?? null;
}

function storeRole(preference: StorePreference, store: "Coles" | "Woolworths") {
  if (preference === "Either") return "primary" as const;
  if (preference === store) return "primary" as const;
  return "compare" as const;
}

export function EstimateBill({ items, onClose }: EstimateBillProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const ready = useMemo(() => estimateItems(items), [items]);
  const [rows, setRows] = useState<RowState[]>(() =>
    ready.map((item) => ({ item, loading: true, coles: [], woolworths: [] })),
  );
  const [loaded, setLoaded] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    const cache = readClientPriceCache();

    function rowFromPayload(item: GroceryItem, payload: PriceSearchResponse | null): RowState {
      return {
        item,
        loading: false,
        coles: payload?.coles.matches ?? [],
        woolworths: payload?.woolworths.matches ?? [],
        colesId: payload?.coles.matches[0]?.id,
        woolworthsId: payload?.woolworths.matches[0]?.id,
        colesError: payload?.coles.error,
        woolworthsError: payload?.woolworths.error,
        error: payload?.coles.error && payload?.woolworths.error ? "No prices returned." : undefined,
      };
    }

    async function load() {
      const payloads = new Map<string, PriceSearchResponse>();
      const uncached: GroceryItem[] = [];
      for (const item of ready) {
        const cached = cache[priceCacheKey(item)];
        if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
          payloads.set(item.id, cached.payload);
        } else {
          uncached.push(item);
        }
      }

      if (uncached.length) {
        try {
          const response = await fetch("/api/prices/estimate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              items: uncached.map((item) => ({
                id: item.id,
                name: item.name,
                qty: itemSearchQuantity(item),
                category: item.category,
              })),
            }),
          });
          const data = (await response.json()) as {
            results?: Array<PriceSearchResponse & { id?: string }>;
            error?: string;
          };
          if (!response.ok) {
            throw new Error(data.error || "Estimate lookup failed.");
          }
          for (const result of data.results ?? []) {
            if (!result.id) continue;
            payloads.set(result.id, result);
            if (!result.coles.error && !result.woolworths.error) {
              const item = uncached.find((entry) => entry.id === result.id);
              if (item && (result.coles.matches.length || result.woolworths.matches.length)) {
                cache[priceCacheKey(item)] = { fetchedAt: Date.now(), payload: result };
              }
            }
          }
          writeClientPriceCache(cache);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Lookup failed.";
          for (const item of uncached) {
            payloads.set(item.id, {
              query: item.name,
              coles: { store: "Coles", matches: [], error: "Coles lookup failed." },
              woolworths: { store: "Woolworths", matches: [], error: message },
            });
          }
        }
      }

      if (cancelled) return;
      setRows(ready.map((item) => rowFromPayload(item, payloads.get(item.id) ?? null)));
      setLoaded(ready.length);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function retry(item: GroceryItem) {
    setRows((current) =>
      current.map((row) => (row.item.id === item.id ? { ...row, loading: true, error: undefined } : row)),
    );
    try {
      const response = await fetch(
        `/api/prices/search?q=${encodeURIComponent(item.name)}&qty=${encodeURIComponent(itemSearchQuantity(item))}&category=${encodeURIComponent(item.category)}&refresh=1`,
      );
      const payload = (await response.json()) as PriceSearchResponse;
      if (!payload.coles.error && !payload.woolworths.error) {
        const cache = readClientPriceCache();
        cache[priceCacheKey(item)] = { fetchedAt: Date.now(), payload };
        writeClientPriceCache(cache);
      }
      setRows((current) =>
        current.map((row) =>
          row.item.id === item.id
            ? {
                item,
                loading: false,
                coles: payload.coles.matches,
                woolworths: payload.woolworths.matches,
                colesId: payload.coles.matches[0]?.id,
                woolworthsId: payload.woolworths.matches[0]?.id,
                colesError: payload.coles.error,
                woolworthsError: payload.woolworths.error,
                error: payload.coles.error && payload.woolworths.error ? "No prices returned." : undefined,
              }
            : row,
        ),
      );
    } catch (error) {
      setRows((current) =>
        current.map((row) =>
          row.item.id === item.id
            ? {
                ...row,
                loading: false,
                error: error instanceof Error ? error.message : "Retry failed.",
              }
            : row,
        ),
      );
    }
  }

  const totals = useMemo(() => {
    let coles = 0;
    let woolworths = 0;
    let mix = 0;
    let colesCount = 0;
    let woolworthsCount = 0;
    let mixCount = 0;
    let missing = 0;

    for (const row of rows) {
      const colesProduct = pick(row.coles, row.colesId);
      const woolProduct = pick(row.woolworths, row.woolworthsId);
      const colesCost = colesProduct ? estimateLineCost(colesProduct, itemSearchQuantity(row.item)) : null;
      const woolCost = woolProduct ? estimateLineCost(woolProduct, itemSearchQuantity(row.item)) : null;
      const prefer = row.item.store;

      if ((prefer === "Coles" || prefer === "Either") && colesCost) {
        coles += colesCost.amount;
        colesCount += 1;
      }
      if ((prefer === "Woolworths" || prefer === "Either") && woolCost) {
        woolworths += woolCost.amount;
        woolworthsCount += 1;
      }

      if (prefer === "Coles") {
        if (colesCost) {
          mix += colesCost.amount;
          mixCount += 1;
        } else missing += 1;
      } else if (prefer === "Woolworths") {
        if (woolCost) {
          mix += woolCost.amount;
          mixCount += 1;
        } else missing += 1;
      } else if (colesCost && woolCost) {
        mix += Math.min(colesCost.amount, woolCost.amount);
        mixCount += 1;
      } else if (colesCost) {
        mix += colesCost.amount;
        mixCount += 1;
      } else if (woolCost) {
        mix += woolCost.amount;
        mixCount += 1;
      } else if (!row.loading) {
        missing += 1;
      }
    }

    return { coles, woolworths, mix, colesCount, woolworthsCount, mixCount, missing };
  }, [rows]);

  const wooliesStoreError = rows.find((row) => row.woolworthsError && !row.loading)?.woolworthsError;
  const colesStoreError = rows.find((row) => row.colesError && !row.loading)?.colesError;
  const wooliesUnavailable = Boolean(wooliesStoreError) && totals.woolworthsCount === 0;
  const colesUnavailable = Boolean(colesStoreError) && totals.colesCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close estimate" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="estimate-title"
        tabIndex={-1}
        className="paper-card relative z-10 flex max-h-[94vh] w-full max-w-4xl flex-col rounded-t-3xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Estimate · AUD · checked items</p>
            <h2 id="estimate-title" className="font-display mt-1 flex items-center gap-2 text-2xl sm:text-3xl">
              <ReceiptIcon className="h-7 w-7" />
              Estimate this week’s bill
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:text-ink" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm leading-6">{ESTIMATE_DISCLAIMER}</p>

          {wooliesStoreError || colesStoreError ? (
            <p role="alert" className="rounded-2xl bg-clay/10 px-4 py-3 text-sm leading-6 text-clay">
              {wooliesStoreError ? <span className="font-medium">Woolies: {wooliesStoreError}</span> : null}
              {wooliesStoreError && colesStoreError ? <span className="mt-2 block" /> : null}
              {colesStoreError ? <span className="font-medium">Coles: {colesStoreError}</span> : null}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <TotalCard
              label="Coles basket"
              hint={colesUnavailable ? "Coles unavailable" : `${totals.colesCount} priced`}
              amount={totals.coles}
              tone="coles"
              unavailable={colesUnavailable}
            />
            <TotalCard
              label="Woolies basket"
              hint={wooliesUnavailable ? "Woolies unavailable" : `${totals.woolworthsCount} priced`}
              amount={totals.woolworths}
              tone="woolies"
              unavailable={wooliesUnavailable}
            />
            <TotalCard label="Cheapest mix" hint={`${totals.mixCount} priced`} amount={totals.mix} tone="mix" />
          </div>

          {ready.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-muted">
              Check the items you want priced, then Estimate bill.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                {loaded}/{ready.length} looked up
                {totals.missing ? ` · ${totals.missing} with no usable match` : ""}
                . Change a product if the top hit looks wrong — totals update immediately.
              </p>
              {loaded < ready.length ? (
                <p className="text-sm text-muted">
                  Looking up Coles and Woolworths together. If Woolies is blocked, the first Apify
                  Estimate can take about a minute.
                </p>
              ) : null}
              <ul className="space-y-3">
                {rows.map((row) => (
                  <EstimateRow key={row.item.id} row={row} onRetry={() => retry(row.item)} onSelect={setRows} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TotalCard({
  label,
  hint,
  amount,
  tone,
  unavailable = false,
}: {
  label: string;
  hint: string;
  amount: number;
  tone: "coles" | "woolies" | "mix";
  unavailable?: boolean;
}) {
  const ring =
    tone === "coles" ? "border-coles/40" : tone === "woolies" ? "border-woolies/40" : "border-sage/40";
  return (
    <div className={`rounded-2xl border bg-paper px-4 py-3 ${ring}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="font-display mt-1 text-2xl">{unavailable ? "—" : formatAud(amount)}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function EstimateRow({
  row,
  onRetry,
  onSelect,
}: {
  row: RowState;
  onRetry: () => void;
  onSelect: Dispatch<SetStateAction<RowState[]>>;
}) {
  const colesProduct = pick(row.coles, row.colesId);
  const woolProduct = pick(row.woolworths, row.woolworthsId);

  function choose(store: "coles" | "woolworths", id: string) {
    onSelect((current) =>
      current.map((entry) =>
        entry.item.id === row.item.id
          ? { ...entry, [store === "coles" ? "colesId" : "woolworthsId"]: id }
          : entry,
      ),
    );
  }

  return (
    <li className="rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">
            {row.item.name}{" "}
            <span className="text-sm font-normal text-muted">{itemDisplayQuantity(row.item)}</span>
          </p>
          <p className="text-xs text-muted">
            Preference: {row.item.store === "Woolworths" ? "Woolies" : row.item.store}
            {row.item.store !== "Either" ? " · other store shown for comparison" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className={`inline-flex items-center gap-1 text-xs ${
            row.woolworthsError || row.colesError || row.error ? "font-semibold text-clay" : "text-sage"
          }`}
          disabled={row.loading}
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>

      {row.loading ? (
        <p className="mt-3 text-sm text-muted">Looking up Coles and Woolworths…</p>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <StoreMatch
            store="Coles"
            role={storeRole(row.item.store, "Coles")}
            matches={row.coles}
            selected={colesProduct}
            quantity={itemSearchQuantity(row.item)}
            error={row.colesError}
            onChoose={(id) => choose("coles", id)}
          />
          <StoreMatch
            store="Woolworths"
            role={storeRole(row.item.store, "Woolworths")}
            matches={row.woolworths}
            selected={woolProduct}
            quantity={itemSearchQuantity(row.item)}
            error={row.woolworthsError}
            onChoose={(id) => choose("woolworths", id)}
          />
        </div>
      )}
    </li>
  );
}

function StoreMatch({
  store,
  role,
  matches,
  selected,
  quantity,
  error,
  onChoose,
}: {
  store: "Coles" | "Woolworths";
  role: "primary" | "compare";
  matches: PricedProduct[];
  selected: PricedProduct | null;
  quantity: string;
  error?: string;
  onChoose: (id: string) => void;
}) {
  const cost = selected ? estimateLineCost(selected, quantity) : null;
  const weak = isWeakMatch(selected);
  const label = store === "Woolworths" ? "Woolies" : "Coles";

  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        role === "compare" ? "border-dashed border-line opacity-90" : "border-line bg-paper"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs font-semibold ${store === "Coles" ? "text-coles" : "text-woolies"}`}>
          {label}
          {role === "compare" ? " · comparison" : ""}
        </p>
        {selected?.onSpecial ? (
          <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[11px] font-semibold">On special</span>
        ) : null}
      </div>

      {error && !selected ? (
        <p className="mt-2 text-sm text-clay">{error}</p>
      ) : !selected ? (
        <p className="mt-2 text-sm text-muted">No match</p>
      ) : (
        <>
          <p className="mt-1 text-sm font-medium leading-5">{selected.name}</p>
          <p className="text-xs text-muted">
            {selected.packSize}
            {selected.unitPriceLabel ? ` · ${selected.unitPriceLabel}` : ""}
          </p>
          <p className="mt-2 font-display text-xl">{cost ? formatAud(cost.amount) : "—"}</p>
          {cost?.scaled ? <p className="text-xs text-muted">{cost.note}</p> : null}
          {weak ? <p className="text-xs text-clay">Weak match — pick another if this looks wrong.</p> : null}
          {matches.length > 1 ? (
            <label className="mt-2 block text-xs text-muted">
              Alternate
              <select
                value={selected.id}
                onChange={(event) => onChoose(event.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-line bg-card px-2 text-sm text-ink"
              >
                {matches.map((product) => (
                  <option key={product.id} value={product.id}>
                    {formatAud(product.price ?? 0)} · {product.name} ({product.packSize})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selected.url ? (
            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-sage underline-offset-2 hover:underline"
            >
              Open on {label}
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}
