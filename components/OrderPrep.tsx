"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AGENT_INSTRUCTIONS, buildShoppingPayload, formatShoppingList } from "@/lib/export";
import type { GroceryItem } from "@/lib/types";
import { CloseIcon, CopyIcon, DownloadIcon } from "./icons";

type OrderPrepProps = {
  items: GroceryItem[];
  onClose: () => void;
};

export function OrderPrep({ items, onClose }: OrderPrepProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const payload = useMemo(() => buildShoppingPayload(items), [items]);
  const text = useMemo(() => formatShoppingList(payload), [payload]);
  const [copied, setCopied] = useState<"list" | "json" | "">("");

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

  async function copy(value: string, kind: "list" | "json") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(""), 1800);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `roland-groceries-${payload.generatedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close order prep" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-prep-title"
        tabIndex={-1}
        className="paper-card relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-3xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Coles + Woolworths</p>
            <h2 id="order-prep-title" className="font-display mt-1 text-2xl sm:text-3xl">
              Prepare this week’s order
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:text-ink" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-2xl bg-sage-soft px-4 py-3 text-sm leading-6 text-ink">
            {AGENT_INSTRUCTIONS} Checked-off items and “every few weeks / monthly” rows that are not
            included this week are left out.
          </div>

          {payload.itemCount === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-muted">
              Nothing left to send. Uncheck items or include an occasional staple, then try again.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold">Copyable list</h3>
                <pre className="mt-2 max-h-80 overflow-auto rounded-2xl bg-paper p-4 text-xs leading-5 whitespace-pre-wrap">
                  {text}
                </pre>
              </section>
              <section>
                <h3 className="text-sm font-semibold">Agent JSON</h3>
                <pre className="mt-2 max-h-80 overflow-auto rounded-2xl bg-paper p-4 text-xs leading-5 whitespace-pre-wrap">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </section>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => copy(text, "list")}
            disabled={!payload.itemCount}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <CopyIcon className="h-4 w-4" />
            {copied === "list" ? "List copied" : "Copy list"}
          </button>
          <button
            type="button"
            onClick={() => copy(JSON.stringify(payload, null, 2), "json")}
            disabled={!payload.itemCount}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <CopyIcon className="h-4 w-4" />
            {copied === "json" ? "JSON copied" : "Copy JSON"}
          </button>
          <button
            type="button"
            onClick={downloadJson}
            disabled={!payload.itemCount}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sage px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Download JSON
          </button>
        </div>
      </div>
    </div>
  );
}
