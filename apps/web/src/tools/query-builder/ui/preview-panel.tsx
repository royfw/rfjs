"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";

import type { EngineOutput } from "@/tools/query-builder/logic/engines";
import type { LiveMatchResult } from "@/tools/query-builder/logic/live-match";

export function PreviewPanel({
  output,
  live,
}: {
  output: EngineOutput;
  live: LiveMatchResult;
}) {
  const t = useTranslations("ToolUI");
  return (
    <Panel
      title={t("output")}
      action={output.ok ? <CopyButton text={output.primary} label={t("copy")} /> : null}
    >
      <div className="flex flex-col gap-3">
        {output.ok ? (
          <>
            <pre className="overflow-x-auto font-mono text-sm text-signal">{output.primary}</pre>
            {output.secondary ? (
              <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{output.secondary}</pre>
            ) : null}
          </>
        ) : (
          <p className="font-mono text-sm text-fault">{output.error}</p>
        )}
        <div className="border-t border-border pt-2">
          {live.uncoverable ? (
            <p className="font-mono text-xs text-muted-foreground">{t("notPreviewable")}</p>
          ) : (
            <>
              <p className="mb-1 font-mono text-xs text-muted-foreground">{t("matched", { count: live.count })}</p>
              <pre className="max-h-48 overflow-auto font-mono text-xs text-muted-foreground">
                {JSON.stringify(live.matched, null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
