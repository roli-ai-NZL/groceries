export const WOOLWORTHS_AKAMAI_ERROR = "Woolworths blocked this server (Akamai).";

export const WOOLWORTHS_UNAVAILABLE_NO_TOKEN =
  "Woolworths blocked this server (Akamai). Woolies prices are unavailable from this host. Coles still works. Add a free APIFY_TOKEN in Vercel (see README) and redeploy for a Woolies fallback, or tap Retry.";

export const WOOLWORTHS_APIFY_FAILED =
  "Woolworths blocked this server (Akamai), and the Apify fallback failed. Coles still works. Check APIFY_TOKEN or tap Retry.";

export type WoolworthsFailureKind = "blocked" | "empty" | "nomatch" | "http" | "reset" | "ok";

export type WoolworthsStartAction = "direct" | "call-apify" | "unavailable";

export type WoolworthsFollowUp =
  | "use-matches"
  | "nomatch"
  | "call-apify"
  | "unavailable"
  | "surface-error";

export function classifyWoolworthsResponse(
  status: number,
  bodyText: string,
  contentType?: string | null,
): WoolworthsFailureKind {
  const text = bodyText.slice(0, 8000);
  const html = /text\/html/i.test(contentType ?? "") || /^\s*</.test(text);
  const denied = /access denied|reference #|akamai|errors\.edgesuite|pardon our interruption/i.test(
    text,
  );

  if (status === 403 || denied) return "blocked";
  if (html && (status >= 400 || denied || !/"Products"\s*:/.test(text))) return "blocked";
  if (status >= 400) return "http";
  return "ok";
}

export function classifyParsedWoolworthsBody(data: unknown): WoolworthsFailureKind {
  if (!data || typeof data !== "object") return "empty";
  if (!("Products" in data)) return "empty";
  return "nomatch";
}

export function isConnectionReset(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /econnreset|econnrefused|etimedout|epipe|socket|network|fetch failed|undici|aborted/i.test(
    message,
  );
}

export function isRetryableWoolworthsFailure(kind: WoolworthsFailureKind): boolean {
  return kind === "blocked" || kind === "empty" || kind === "reset" || kind === "nomatch";
}

export function shouldFallbackToApify(kind: WoolworthsFailureKind): boolean {
  return kind === "blocked" || kind === "empty" || kind === "reset";
}

export function decideWoolworthsStart(
  alreadyBlocked: boolean,
  hasToken: boolean,
): WoolworthsStartAction {
  if (!alreadyBlocked) return "direct";
  return hasToken ? "call-apify" : "unavailable";
}

export function decideWoolworthsFollowUp(args: {
  alreadyBlocked: boolean;
  hasToken: boolean;
  kind?: WoolworthsFailureKind;
  matchCount: number;
}): WoolworthsFollowUp {
  if (args.matchCount > 0) return "use-matches";
  if (args.alreadyBlocked) return args.hasToken ? "call-apify" : "unavailable";
  if (!args.kind || args.kind === "ok" || args.kind === "nomatch") return "nomatch";
  if (shouldFallbackToApify(args.kind)) return args.hasToken ? "call-apify" : "unavailable";
  return "surface-error";
}

export function woolworthsUnavailableMessage(hasToken: boolean): string {
  return hasToken ? WOOLWORTHS_APIFY_FAILED : WOOLWORTHS_UNAVAILABLE_NO_TOKEN;
}
