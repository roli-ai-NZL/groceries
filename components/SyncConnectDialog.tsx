"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";
import type { FirstConnectPrompt } from "@/lib/sync/types";
import { sydneyDateTimeLabel } from "@/lib/week";

type SyncConnectDialogProps = {
  prompt: FirstConnectPrompt;
  onUpload: () => void;
  onDownload: () => void;
  onClose: () => void;
};

function stamp(value: string | null) {
  return value ? sydneyDateTimeLabel(value) : "no timestamp yet";
}

export function SyncConnectDialog({ prompt, onUpload, onDownload, onClose }: SyncConnectDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <button className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-connect-title"
        tabIndex={-1}
        className="paper-card relative z-10 w-full max-w-md rounded-3xl p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="sync-connect-title" className="font-display text-2xl">
            This device and the cloud both have a list
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:text-ink" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          Pick one to start sharing. After that, edits sync both ways. Last save wins if phone and
          laptop change the list at the same time.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="rounded-2xl border border-line bg-paper/60 px-4 py-3">
            <dt className="font-semibold text-ink">This device</dt>
            <dd className="mt-1 text-muted">
              {prompt.localCount} items · last edited {stamp(prompt.localUpdatedAt)}
            </dd>
          </div>
          <div className="rounded-2xl border border-line bg-paper/60 px-4 py-3">
            <dt className="font-semibold text-ink">Cloud</dt>
            <dd className="mt-1 text-muted">
              {prompt.cloudCount} items · last saved {stamp(prompt.cloudUpdatedAt)}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onUpload}
            className="rounded-full bg-sage px-4 py-2.5 text-sm font-semibold text-white"
          >
            Upload this device&apos;s list
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="rounded-full border border-line px-4 py-2.5 text-sm font-medium"
          >
            Use the cloud list
          </button>
          <button type="button" onClick={onClose} className="text-sm text-muted underline-offset-2 hover:underline">
            Decide later — keep using this device only for now
          </button>
        </div>
      </div>
    </div>
  );
}
