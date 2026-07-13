"use client";

import { type DataType } from "@rfjs/data-transform";
import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@rfjs/web-ui/components/dropdown-menu";
import { Input } from "@rfjs/web-ui/components/input";
import { Panel } from "@rfjs/web-ui/components/panel";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { convertType, CONVERT_TYPES } from "./type-converter";

import { ToolIntro } from "@/components/shared/tool-intro";
import { ToolShell } from "@/tools/_shared/tool-shell";

export function TypeConverter() {
  const t = useTranslations("ToolUI");
  const [value, setValue] = useState("42");
  const [type, setType] = useState<DataType>("number");
  const result = convertType(value, type);

  return (
    <div className="flex flex-col gap-4">
      <ToolIntro
        storageKey="tool-intro:type-converter"
        question={t("introQuestion")}
        tagline={t("tcvIntroTagline")}
        concepts={[
          { term: t("tcvIntroC1t"), desc: t("tcvIntroC1d") },
          { term: t("tcvIntroC2t"), desc: t("tcvIntroC2d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />
      <ToolShell
        operation="typeTransfer()"
        input={
          <Panel title={t("input")}>
            <div className="flex flex-col gap-2">
              <Input
                aria-label={t("inputValue")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label={t("targetType")} className="justify-between gap-2">
                    {t(`types.${type}`)}
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={type}
                    onValueChange={(next) => setType(next as DataType)}
                  >
                    {CONVERT_TYPES.map((ty) => (
                      <DropdownMenuRadioItem key={ty} value={ty}>
                        {t(`types.${ty}`)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Panel>
        }
        output={
          <Panel
            title={t("output")}
            action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}
          >
            {result.ok ? (
              <div className="flex flex-col gap-1">
                <pre className="overflow-x-auto font-mono text-sm text-foreground">{result.output}</pre>
                <span className="font-mono text-[10px] text-muted-foreground">{result.runtimeType}</span>
              </div>
            ) : (
              <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
            )}
          </Panel>
        }
      />
    </div>
  );
}
