/** Merge `Set-Cookie` header values into a Cookie request header. Later names win. */
export function mergeCookieJar(existing: string, setCookieHeaders: string[]): string {
  const next = setCookieHeaders
    .map((entry) => entry.split(";")[0]?.trim())
    .filter((part): part is string => Boolean(part) && part.includes("="));

  if (!next.length) return existing;

  const merged = new Map<string, string>();
  for (const part of `${existing};${next.join(";")}`
    .split(";")
    .map((piece) => piece.trim())
    .filter(Boolean)) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    merged.set(part.slice(0, idx), part);
  }
  return [...merged.values()].join("; ");
}

export function readSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = headers.getSetCookie?.bind(headers);
  const cookies = getSetCookie ? getSetCookie() : [];
  if (cookies.length) return cookies;
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}
