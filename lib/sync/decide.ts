import type { FirstConnectDecision } from "./types";

export function decideSyncAction(input: {
  paired: boolean;
  hadLocalSave: boolean;
  localUpdatedAt: string | null;
  cloudUpdatedAt: string | null;
  cloudCount: number;
}): FirstConnectDecision {
  if (!input.paired) {
    if (input.cloudCount === 0) return "upload";
    if (!input.hadLocalSave) return "download";
    return "ask";
  }

  const local = input.localUpdatedAt ?? "";
  const cloud = input.cloudUpdatedAt ?? "";
  if (cloud > local) return "pull";
  if (local > cloud) return "push";
  return "noop";
}
