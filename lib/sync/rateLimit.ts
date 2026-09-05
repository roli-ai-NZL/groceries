type Bucket = { count: number; resetAt: number };

const unlockAttempts = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export function tooManyUnlocks(key: string) {
  const now = Date.now();
  const current = unlockAttempts.get(key);
  if (!current || current.resetAt <= now) {
    unlockAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}
