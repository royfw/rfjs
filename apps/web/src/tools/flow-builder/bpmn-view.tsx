"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { BpmnViewer } from "@rfjs/bpmn-ui";
import { Button } from "@rfjs/web-ui/components/button";
import { Switch } from "@rfjs/web-ui/components/switch";
import { projectFlow, type FlowDoc } from "@rfjs/flow-core";

import { compileToBpmn } from "./bpmn";

// dark 模式容器套 invert(做法複製自 bpmn-viewer tool 的 ui.tsx;因並行紅線
// 不動共用檔,本地維護一份):圖形填色 #b9b9b9 → 反轉後 ≈ #464646,
// 明顯比畫布(#d4d4d4 → #2b2b2b)亮,shape 內底不是死黑。
const BPMN_DARK_CSS = `
.dark .bpmn-invert .djs-visual rect,
.dark .bpmn-invert .djs-visual circle,
.dark .bpmn-invert .djs-visual polygon {
  fill: #b9b9b9 !important;
}
`;

/** BPMN 分頁面板:即時編譯當前 FlowDoc → 唯讀檢視 + 投影切換 + 下載 .bpmn。 */
export function BpmnViewPanel({ doc }: { doc: FlowDoc }) {
  const t = useTranslations("ToolUI");
  const [projected, setProjected] = React.useState(false);

  const xml = React.useMemo(
    () => compileToBpmn(projected ? projectFlow(doc, { keep: ["form", "condition"] }) : doc),
    [doc, projected],
  );

  const onDownload = () => {
    const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "flow.bpmn";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={projected} onCheckedChange={setProjected} aria-label={t("flowBpmnProjection")} />
          {t("flowBpmnProjection")}
        </label>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onDownload}>
          <Download className="mr-1 h-4 w-4" />
          {t("flowBpmnDownload")}
        </Button>
      </div>
      <style>{BPMN_DARK_CSS}</style>
      <BpmnViewer
        xml={xml}
        ariaLabel={t("flowBpmnLabel")}
        className="bpmn-invert h-[560px] w-full rounded-md border bg-white dark:bg-[#d4d4d4] dark:invert dark:hue-rotate-180"
      />
    </div>
  );
}
