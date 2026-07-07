# jwt-decoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `jwt-decoder` web quick tool live — paste a JWT, see its header + payload + signature and a live expiry status — dogfooding `@rfjs/jwt`.

**Architecture:** `@rfjs/jwt` gains a static `decodeComplete`. A Node-runtime Next route handler (`POST /api/tools/jwt-decode`) calls it server-side (the package is not client-safe). A client component (ToolShell) debounces input → fetches the route; a 1 s interval re-computes only the expiry chip from the cached payload.

**Tech Stack:** Next.js App Router (route handler + client component), `@rfjs/jwt` (wraps `jsonwebtoken`), next-intl, Vitest.

**Context:** Working in worktree `feat-jwt-decoder`. Spec: `docs/superpowers/specs/2026-06-14-jwt-decoder-design.md`. Run all commands from the worktree root. `pnpm install` has already been run here.

---

## File Structure

- `packages/jwt/src/jwt.ts` — add static `Jwt.decodeComplete` (modify)
- `packages/jwt/src/jwt.spec.ts` — add `decodeComplete` tests (modify)
- `.changeset/jwt-decode-complete.md` — minor bump for `@rfjs/jwt` (create)
- `apps/web/package.json` + `pnpm-lock.yaml` — add `@rfjs/jwt` dep (modify)
- `apps/web/src/app/api/tools/jwt-decode/route.ts` — POST handler (create)
- `apps/web/src/app/api/tools/jwt-decode/route.spec.ts` — handler tests (create)
- `apps/web/src/lib/tools/jwt-decoder.ts` — `decodeJwt` fetch wrapper + pure `describeExp`/`formatDuration` (create)
- `apps/web/src/lib/tools/jwt-decoder.spec.ts` — pure-helper tests (create)
- `apps/web/src/components/tools/jwt-decoder.tsx` — client component (create)
- `apps/web/src/components/tools/registry.tsx` — register the component (modify)
- `apps/web/src/messages/{en,zh-TW}.json` — `ToolUI` keys (modify)

---

### Task 1: `Jwt.decodeComplete` in `@rfjs/jwt`

**Files:**
- Modify: `packages/jwt/src/jwt.ts`
- Test: `packages/jwt/src/jwt.spec.ts`
- Create: `.changeset/jwt-decode-complete.md`

- [ ] **Step 1: Write the failing test** — append to `packages/jwt/src/jwt.spec.ts` (inside the top-level `describe`, after the existing blocks):

```ts
  describe('decodeComplete', () => {
    it('returns header, payload and signature for a valid token', () => {
      const token = Jwt.initial('secret').createToken({ id: 1 });
      const decoded = Jwt.decodeComplete(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.header).toMatchObject({ alg: 'HS256', typ: 'JWT' });
      expect(decoded?.payload).toMatchObject({ id: 1 });
      expect(typeof decoded?.signature).toBe('string');
    });

    it('returns null for a malformed token', () => {
      expect(Jwt.decodeComplete('not-a-jwt')).toBeNull();
    });
  });
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -F @rfjs/jwt vitest:run`
Expected: FAIL — `Jwt.decodeComplete is not a function`.

- [ ] **Step 3: Implement** — in `packages/jwt/src/jwt.ts`, add this static method to the `Jwt` class (e.g. directly after the `static initial(...)` method). `decode` is already imported at the top of the file:

```ts
  /**
   * Full decode (header + payload + signature) WITHOUT verifying the signature.
   * Static because decoding needs no secret. Returns `null` for a malformed
   * token (`jsonwebtoken.decode` returns null rather than throwing).
   */
  static decodeComplete(token: string) {
    return decode(token, { complete: true });
  }
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -F @rfjs/jwt vitest:run`
Expected: PASS (all existing tests + the 2 new ones).

- [ ] **Step 5: Create the changeset** — `.changeset/jwt-decode-complete.md`:

```md
---
"@rfjs/jwt": minor
---

Add `Jwt.decodeComplete(token)` — a static, no-secret full decode returning `{ header, payload, signature } | null` (wraps `jsonwebtoken.decode` with `{ complete: true }`).
```

- [ ] **Step 6: Commit**

```bash
git add packages/jwt/src/jwt.ts packages/jwt/src/jwt.spec.ts .changeset/jwt-decode-complete.md
git commit -m "feat(jwt): add Jwt.decodeComplete static (header+payload+signature)"
```

---

### Task 2: `apps/web` depends on `@rfjs/jwt`

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Add the dependency** — in `apps/web/package.json`, add to `dependencies` (keep the `@rfjs/*` entries alphabetical; it sorts before `@rfjs/mongo-query`):

```json
    "@rfjs/jwt": "workspace:*",
```

- [ ] **Step 2: Update the lockfile**

Run: `pnpm install`
Expected: lockfile updated, install succeeds.

- [ ] **Step 3: Build `@rfjs/jwt`** so `apps/web` (and the route test) resolve its `dist` with the new method:

Run: `pnpm -F @rfjs/jwt build`
Expected: build succeeds; `packages/jwt/dist` exists.

- [ ] **Step 4: Verify the lockfile is consistent**

Run: `pnpm install --frozen-lockfile`
Expected: succeeds with no changes ("Already up to date" / no lockfile diff).

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @rfjs/jwt dependency"
```

---

### Task 3: Route handler `POST /api/tools/jwt-decode`

**Files:**
- Create: `apps/web/src/app/api/tools/jwt-decode/route.ts`
- Test: `apps/web/src/app/api/tools/jwt-decode/route.spec.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/src/app/api/tools/jwt-decode/route.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Jwt } from "@rfjs/jwt";

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://test/api/tools/jwt-decode", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/tools/jwt-decode", () => {
  it("decodes a valid token", async () => {
    const token = Jwt.initial("secret").createToken({ id: 1 });
    const res = await post({ token });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.header).toMatchObject({ alg: "HS256" });
    expect(json.payload).toMatchObject({ id: 1 });
    expect(typeof json.signature).toBe("string");
  });

  it("returns ok:false for a malformed token", async () => {
    const res = await post({ token: "not-a-jwt" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "invalidJwt" });
  });

  it("returns 400 for a bad body", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -F web vitest:run route`
Expected: FAIL — cannot resolve `./route` (file does not exist).

- [ ] **Step 3: Implement** — `apps/web/src/app/api/tools/jwt-decode/route.ts`. A plain guard validates the one-field body (no zod dependency needed for a single string):

```ts
import { Jwt } from "@rfjs/jwt";

// @rfjs/jwt wraps jsonwebtoken (require('crypto')) → Node runtime only.
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  const token =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;

  if (!token) {
    return Response.json({ ok: false, error: "badRequest" }, { status: 400 });
  }

  const decoded = Jwt.decodeComplete(token);
  if (!decoded) {
    return Response.json({ ok: false, error: "invalidJwt" });
  }

  const { header, payload, signature } = decoded;
  return Response.json({ ok: true, header, payload, signature });
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -F web vitest:run route`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/tools/jwt-decode/route.ts apps/web/src/app/api/tools/jwt-decode/route.spec.ts
git commit -m "feat(web): add /api/tools/jwt-decode route handler"
```

---

### Task 4: Client lib — `decodeJwt` + pure `describeExp`/`formatDuration`

**Files:**
- Create: `apps/web/src/lib/tools/jwt-decoder.ts`
- Test: `apps/web/src/lib/tools/jwt-decoder.spec.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/tools/jwt-decoder.spec.ts` (only the pure helpers are tested; `decodeJwt` is a thin fetch wrapper exercised via the route + the browser):

```ts
import { describe, it, expect } from "vitest";

import { describeExp, formatDuration } from "./jwt-decoder";

describe("describeExp", () => {
  it("reports valid with seconds left when exp is in the future", () => {
    expect(describeExp(1000, 400)).toEqual({ state: "valid", secondsLeft: 600 });
  });
  it("reports expired when exp is in the past", () => {
    expect(describeExp(400, 1000)).toEqual({ state: "expired", secondsLeft: -600 });
  });
  it("reports none when there is no exp", () => {
    expect(describeExp(undefined, 1000)).toEqual({ state: "none" });
  });
});

describe("formatDuration", () => {
  it("formats hours, minutes and seconds, dropping empty leading units", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
    expect(formatDuration(65)).toBe("1m 5s");
    expect(formatDuration(9)).toBe("9s");
  });
  it("uses the magnitude regardless of sign", () => {
    expect(formatDuration(-65)).toBe("1m 5s");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -F web vitest:run jwt-decoder`
Expected: FAIL — cannot resolve `./jwt-decoder`.

- [ ] **Step 3: Implement** — `apps/web/src/lib/tools/jwt-decoder.ts`:

```ts
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
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -F web vitest:run jwt-decoder`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tools/jwt-decoder.ts apps/web/src/lib/tools/jwt-decoder.spec.ts
git commit -m "feat(web): add jwt-decoder client lib (decodeJwt + describeExp)"
```

---

### Task 5: Client component + registry + i18n

**Files:**
- Create: `apps/web/src/components/tools/jwt-decoder.tsx`
- Modify: `apps/web/src/components/tools/registry.tsx`
- Modify: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`

- [ ] **Step 1: Add i18n keys** — in `apps/web/src/messages/en.json`, inside the `"ToolUI"` object, add these keys alongside the existing flat keys (e.g. after `"dialect"`):

```json
    "token": "JWT",
    "header": "Header",
    "payload": "Payload",
    "signature": "Signature",
    "expiresIn": "expires in {duration}",
    "expired": "expired",
    "noExpiry": "no expiry",
```

and inside the existing `"ToolUI"` → `"error"` object, add:

```json
      "invalidJwt": "Not a valid JWT",
      "request": "Decode request failed",
```

- [ ] **Step 2: Add the same keys to `apps/web/src/messages/zh-TW.json`** — `"ToolUI"` flat keys:

```json
    "token": "JWT",
    "header": "Header",
    "payload": "Payload",
    "signature": "簽章",
    "expiresIn": "{duration}後過期",
    "expired": "已過期",
    "noExpiry": "無有效期",
```

and `"ToolUI"` → `"error"`:

```json
      "invalidJwt": "不是有效的 JWT",
      "request": "解碼請求失敗",
```

- [ ] **Step 3: Create the component** — `apps/web/src/components/tools/jwt-decoder.tsx`. The default `SAMPLE` is the well-known public jwt.io demo token (no secret, no `exp` → expiry chip shows "no expiry"):

```tsx
"use client";

import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { decodeJwt, describeExp, formatDuration, type DecodeResult } from "@/lib/tools/jwt-decoder";

import { ToolShell } from "./tool-shell";

const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

export function JwtDecoder() {
  const t = useTranslations("ToolUI");
  const [token, setToken] = useState(SAMPLE);
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  // Re-decode (server fetch) only when the token input changes, debounced.
  useEffect(() => {
    const trimmed = token.trim();
    if (!trimmed) {
      setResult(null);
      return;
    }
    const id = setTimeout(() => {
      void decodeJwt(trimmed).then(setResult);
    }, 300);
    return () => clearTimeout(id);
  }, [token]);

  const exp =
    result?.ok && result.payload && typeof result.payload === "object"
      ? (result.payload as { exp?: number }).exp
      : undefined;

  // Live expiry: re-tick `now` every second (chip only — no re-fetch). Runs only
  // while a decoded payload carries an `exp`.
  useEffect(() => {
    if (typeof exp !== "number") return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [exp]);

  const info = describeExp(exp, nowSec);
  const expLabel =
    info.state === "none"
      ? t("noExpiry")
      : info.state === "expired"
        ? t("expired")
        : t("expiresIn", { duration: formatDuration(info.secondsLeft) });

  return (
    <ToolShell
      operation="decodeComplete()"
      input={
        <Panel title={t("token")}>
          <textarea
            aria-label={t("token")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            spellCheck={false}
            rows={8}
            className="w-full resize-y break-all rounded-sm border bg-transparent p-2 font-mono text-sm"
          />
        </Panel>
      }
      output={
        <Panel title={t("output")}>
          {result === null ? null : !result.ok ? (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <span
                className={`font-mono text-xs ${info.state === "expired" ? "text-fault" : "text-muted-foreground"}`}
              >
                {expLabel}
              </span>
              <JsonBlock label={t("header")} value={result.header} />
              <JsonBlock label={t("payload")} value={result.payload} />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("signature")}
                </span>
                <pre className="overflow-x-auto break-all font-mono text-xs text-muted-foreground">
                  {result.signature}
                </pre>
              </div>
            </div>
          )}
        </Panel>
      }
    />
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <pre className="overflow-x-auto font-mono text-sm text-signal">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Register the component** — in `apps/web/src/components/tools/registry.tsx`, add the import and the map entry:

```tsx
import { JwtDecoder } from "./jwt-decoder";
```

and add to the `TOOL_COMPONENTS` object:

```tsx
  "jwt-decoder": JwtDecoder,
```

- [ ] **Step 5: Verify the whole tool** — run each and confirm:

```bash
pnpm -F @rfjs/jwt vitest:run        # decodeComplete tests pass
pnpm -F web vitest:run              # route (3) + jwt-decoder lib (5) + existing tools all pass
pnpm -F web typecheck               # tsc --noEmit clean
pnpm -F web lint                    # eslint clean
pnpm -F web build                   # SSG builds; /tools/jwt-decoder prerendered, /api/tools/jwt-decode present
```

Expected: all pass; build output lists `/[locale]/tools/jwt-decoder` under SSG (×2 locales) and the `/api/tools/jwt-decode` route.

- [ ] **Step 6: Verify i18n parity**

```bash
node -e "const en=require('./apps/web/src/messages/en.json'),zh=require('./apps/web/src/messages/zh-TW.json');const k=o=>{const a=[];(function w(o,p){for(const x in o){const n=p?p+'.'+x:x;o[x]&&typeof o[x]==='object'?w(o[x],n):a.push(n)}})(o,'');return a.sort()};const e=k(en),z=k(zh);console.log('MATCH',JSON.stringify(e)===JSON.stringify(z))"
```

Expected: `MATCH true`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tools/jwt-decoder.tsx apps/web/src/components/tools/registry.tsx apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json
git commit -m "feat(web): make jwt-decoder tool live"
```

---

## Self-Review Notes

- **Spec coverage:** decode-only (no verify/secret) ✓ Task 3/5; extend `@rfjs/jwt` ✓ Task 1; route handler + Node runtime ✓ Task 3; client component + 300ms debounce ✓ Task 5; exp 1s live tick, no re-fetch ✓ Task 5; pure `describeExp` ✓ Task 4; registry + i18n (incl. `error.request`) + dep ✓ Task 2/5; header+payload+signature shown ✓ Task 5; tests for decodeComplete/route/describeExp ✓ Tasks 1/3/4. Refresh-token explicitly out of scope ✓.
- **Deviation from spec:** body validation uses a plain type guard instead of zod — a single `string` field does not warrant a new dependency (YAGNI); still returns 400 on a bad shape. Bad-body error key is `badRequest` (not surfaced in the UI; it indicates a malformed client request, not user input).
- **Type consistency:** `DecodeResult`, `ExpInfo`, `describeExp(expSec, nowSec)`, `formatDuration`, `decodeJwt` names match across Tasks 4 and 5. The route returns `{ ok, header, payload, signature }` matching `DecodeResult`'s success shape.
