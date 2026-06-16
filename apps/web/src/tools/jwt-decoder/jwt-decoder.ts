export type DecodeResult =
  | { ok: true; header: unknown; payload: unknown; signature: string }
  | { ok: false; error: "invalidJwt" | "request" };

export async function decodeJwt(token: string): Promise<DecodeResult> {
  try {
    const res = await fetch("/api/tools/jwt-decode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return { ok: false, error: "request" };
    return (await res.json()) as DecodeResult;
  } catch {
    return { ok: false, error: "request" };
  }
}

export type ExpInfo =
  | { state: "valid"; secondsLeft: number }
  | { state: "expired"; secondsLeft: number }
  | { state: "none" };

/** Pure: classifies a JWT `exp` (seconds) against an injected `now` (seconds). */
export function describeExp(expSec: number | undefined, nowSec: number): ExpInfo {
  if (typeof expSec !== "number") return { state: "none" };
  const secondsLeft = expSec - nowSec;
  return secondsLeft > 0
    ? { state: "valid", secondsLeft }
    : { state: "expired", secondsLeft };
}

/** Pure: "1h 1m 1s" from a (possibly negative) second count; drops empty leading units. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.abs(Math.trunc(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : "", `${sec}s`].filter(Boolean).join(" ");
}
