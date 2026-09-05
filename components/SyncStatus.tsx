"use client";

import { useState } from "react";
import { SyncConnectDialog } from "./SyncConnectDialog";
import { CloudIcon, CloudOffIcon } from "./icons";
import { useGrocerySync } from "@/lib/useGroceryState";
import { sydneyDateTimeLabel } from "@/lib/week";

function statusLabel(status: ReturnType<typeof useGrocerySync>["status"]) {
  switch (status) {
    case "synced":
      return "Synced";
    case "syncing":
      return "Syncing";
    case "offline":
      return "Offline";
    case "error":
      return "Error";
    case "locked":
      return "Unlock sync";
    default:
      return "This device only";
  }
}

export function SyncBadge() {
  const sync = useGrocerySync();
  const [open, setOpen] = useState(false);
  const Icon = sync.status === "offline" || sync.status === "local" || sync.status === "error" ? CloudOffIcon : CloudIcon;
  const tone =
    sync.status === "error"
      ? "border-clay/40 text-clay"
      : sync.status === "synced"
        ? "border-sage/40 text-sage"
        : "border-line text-muted";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold sm:text-sm ${tone}`}
        aria-expanded={open}
        aria-label={`Cloud sync: ${statusLabel(sync.status)}`}
      >
        <Icon className="h-4 w-4" />
        <span>{statusLabel(sync.status)}</span>
      </button>
      {open ? (
        <div className="paper-card absolute right-0 z-20 mt-2 w-[min(calc(100vw-2rem),18rem)] rounded-2xl p-3 text-sm">
          {!sync.configured ? (
            <p className="leading-6 text-muted">
              Saved on this device only. Add the Supabase env vars (see README) to share the list
              across phone and laptop.
            </p>
          ) : sync.status === "locked" ? (
            <p className="leading-6 text-muted">
              Enter the household access code below to sync with your other devices.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="leading-6 text-muted">
                {sync.lastCloudSavedAt
                  ? `Cloud list last saved ${sydneyDateTimeLabel(sync.lastCloudSavedAt)} (Sydney).`
                  : "Cloud sync is on. Last-write-wins if both devices edit at once."}
              </p>
              {sync.lastError ? <p className="text-clay">{sync.lastError}</p> : null}
              {sync.status === "error" ? (
                <button
                  type="button"
                  onClick={() => {
                    sync.retrySync();
                    setOpen(false);
                  }}
                  className="rounded-full border border-line px-3 py-2 text-left text-sm"
                >
                  Try again
                </button>
              ) : null}
              {sync.unlocked ? (
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      void sync.reloadFromCloud();
                      setOpen(false);
                    }}
                    className="rounded-full border border-line px-3 py-2 text-left text-sm"
                  >
                    Reload from cloud
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void sync.lock();
                      setOpen(false);
                    }}
                    className="rounded-full border border-line px-3 py-2 text-left text-sm"
                  >
                    Stop syncing on this device
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SyncPanels() {
  const sync = useGrocerySync();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      {sync.configured && !sync.unlocked && sync.status !== "syncing" ? (
        <section className="paper-card rounded-3xl p-4 sm:p-5">
          <h2 className="font-display text-2xl">Share this list across devices</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Enter the household access code you set in the Supabase SQL. Same code on phone and
            laptop. The list still works on this device if you skip this.
          </p>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              await sync.unlock(code);
              setBusy(false);
            }}
          >
            <label className="sr-only" htmlFor="household-access-code">
              Household access code
            </label>
            <input
              id="household-access-code"
              type="password"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Household access code"
              className="h-11 w-full rounded-full border border-line bg-paper px-4 text-sm sm:flex-1"
            />
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="h-11 rounded-full bg-sage px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Unlocking…" : "Unlock sync"}
            </button>
          </form>
          {sync.lastError ? <p className="mt-3 text-sm text-clay">{sync.lastError}</p> : null}
        </section>
      ) : null}

      {sync.firstConnect ? (
        <SyncConnectDialog
          prompt={sync.firstConnect}
          onUpload={() => void sync.resolveFirstConnect("upload")}
          onDownload={() => void sync.resolveFirstConnect("download")}
          onClose={sync.dismissFirstConnect}
        />
      ) : null}
    </>
  );
}
