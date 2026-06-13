"use client";

import { type DataType } from "@rfjs/data-transform";
import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rfjs/web-ui/components/dropdown-menu";
import { Panel } from "@rfjs/web-ui/components/panel";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { convertType, CONVERT_TYPES } from "@/lib/tools/type-converter";

import { ToolShell } from "./tool-shell";

export function TypeConverter() {
  const t = useTranslations("ToolUI");
  const [value, setValue] = useState("42");
  const [type, setType] = useState<DataType>("number");
  const result = convertType(value, type);

  return (
    <ToolShell
      operation="typeTransfer()"
      input={
        <Panel title={t("input")}>
          <div className="flex flex-col gap-2">
            <input
              aria-label={t("inputValue")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-sm border bg-transparent px-2 py-1.5 font-mono text-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t("targetType")} className="justify-between gap-2">
                  {t(`types.${type}`)}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {CONVERT_TYPES.map((ty) => (
                  <DropdownMenuItem key={ty} onSelect={() => setType(ty)}>
                    <Check className={ty === type ? "size-4 opacity-100" : "size-4 opacity-0"} />
                    {t(`types.${ty}`)}
                  </DropdownMenuItem>
                ))}
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
              <pre className="overflow-x-auto font-mono text-sm text-signal">{result.output}</pre>
              <span className="font-mono text-[10px] text-muted-foreground">{result.runtimeType}</span>
            </div>
          ) : (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          )}
        </Panel>
      }
    />
  );
}
