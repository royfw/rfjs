"use client";

import { Panel } from "@rfjs/web-ui/components/panel";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { decodeJwt, describeExp, formatDuration, type DecodeResult } from "./jwt-decoder";

import { ToolShell } from "@/tools/_shared/tool-shell";

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
          <Textarea
            aria-label={t("token")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            spellCheck={false}
            rows={8}
            className="resize-y break-all font-mono"
          />
        </Panel>
      }
      output={
        <Panel title={t("output")}>
          {result === null ? null : !result.ok ? (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          ) : (
            <div className="flex flex-col gap-4">
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
      <pre className="overflow-x-auto font-mono text-sm text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
