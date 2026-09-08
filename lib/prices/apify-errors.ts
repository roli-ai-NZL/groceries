export type ApifyErrorCode =
  | "unauthorized"
  | "payment"
  | "forbidden"
  | "actor-missing"
  | "actor-not-rented"
  | "timeout"
  | "empty"
  | "http"
  | "network";

const CODE_LABEL: Record<ApifyErrorCode, string> = {
  unauthorized: "unauthorized",
  payment: "payment required",
  forbidden: "forbidden",
  "actor-missing": "actor not found",
  "actor-not-rented": "actor not rented",
  timeout: "timeout",
  empty: "empty dataset",
  http: "request failed",
  network: "network error",
};

export function shortApifyBodyMessage(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const json = JSON.parse(trimmed) as {
      error?: { message?: unknown; type?: unknown };
      message?: unknown;
    };
    const message = json.error?.message ?? json.error?.type ?? json.message;
    if (typeof message === "string" && message.trim()) {
      return message.replace(/\s+/g, " ").trim().slice(0, 140);
    }
  } catch {
    // Use a compact slice of the raw body below.
  }
  return trimmed.replace(/\s+/g, " ").slice(0, 120);
}

export function classifyApifyHttpStatus(status: number, body = ""): ApifyErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 402) return "payment";
  if (status === 404) return "actor-missing";
  if (status === 403) {
    if (/rent|not rented|must rent|subscribe to this actor|you must pay/i.test(body)) {
      return "actor-not-rented";
    }
    return "forbidden";
  }
  return "http";
}

export function classifyApifyThrown(error: unknown): ApifyErrorCode {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/timeout|timed out|aborted|timing-out/i.test(message)) return "timeout";
  return "network";
}

export function classifyApifyRunStatus(status: string): ApifyErrorCode | null {
  if (status === "TIMED-OUT" || status === "TIMING-OUT") return "timeout";
  if (status === "FAILED" || status === "ABORTED") return "http";
  return null;
}

export function formatWoolworthsApifyError(args: {
  code: ApifyErrorCode;
  status?: number;
  detail?: string;
}): string {
  const label = CODE_LABEL[args.code];
  const statusBit = args.status != null ? `${args.status} ` : "";
  const extra = args.detail ? `: ${args.detail}` : "";
  return `Woolworths blocked this server (Akamai), and the Apify fallback failed (${statusBit}${label}${extra}). Coles still works. Check APIFY_TOKEN or tap Retry.`;
}
