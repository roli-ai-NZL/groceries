"use client";

import { useEffect, useState } from "react";

type QuantityStepperProps = {
  count: number;
  onChange: (count: number) => void;
  disabled?: boolean;
  itemName?: string;
};

export function QuantityStepper({ count, onChange, disabled, itemName }: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(count));

  useEffect(() => {
    setDraft(String(count));
  }, [count]);

  const suffix = itemName ? ` ${itemName}` : "";

  function commit(raw: string) {
    const next = Math.max(1, Number(raw.replace(/\D/g, "") || "1"));
    setDraft(String(next));
    if (next !== count) onChange(next);
  }

  return (
    <div className="inline-flex shrink-0 items-center rounded-full border border-line bg-paper">
      <button
        type="button"
        disabled={disabled || count <= 1}
        aria-label={`Decrease count${suffix}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none text-ink disabled:text-muted disabled:opacity-40"
        onClick={() => onChange(count - 1)}
      >
        −
      </button>
      <div className="flex h-11 min-w-[3.25rem] items-center justify-center gap-0.5 px-0.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          aria-label={`Count${suffix}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-11 w-7 bg-transparent text-center text-base font-semibold tabular-nums outline-none disabled:opacity-50"
        />
        <span className="text-sm font-semibold text-muted" aria-hidden>
          ×
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Increase count${suffix}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none text-ink disabled:opacity-40"
        onClick={() => onChange(count + 1)}
      >
        +
      </button>
    </div>
  );
}
