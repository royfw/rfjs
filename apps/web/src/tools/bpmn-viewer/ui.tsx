"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { BpmnViewer, useBpmnViewer } from "@rfjs/bpmn-ui";
import { Button } from "@rfjs/web-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";

import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
import { ToolIntro } from "@/components/shared/tool-intro";
import { SectionCard } from "@/components/shared/section-card";
import { FragmentBar } from "@/components/shared/fragment-bar";

import { SAMPLES, DEFAULT_SAMPLE_ID, getSample } from "./samples";
import { validateBpmnFile } from "./file-input";

// dark 模式容器套 invert,所以這裡寫「反轉前」的顏色:
// 圖形填色 #b9b9b9 → 反轉後 ≈ #464646,明顯比畫布(#d4d4d4 → #2b2b2b)亮,
// task/事件的內底不再是死黑。
const BPMN_DARK_CSS = `
.dark .bpmn-invert .djs-visual rect,
.dark .bpmn-invert .djs-visual circle,
.dark .bpmn-invert .djs-visual polygon {
  fill: #b9b9b9 !important;
}
`;

export function BpmnViewerTool() {
  const t = useTranslations("ToolUI");
  const v = useBpmnViewer();

  const [xml, setXml] = React.useState(() => getSample(DEFAULT_SAMPLE_ID)?.xml ?? "");
  const [sampleId, setSampleId] = React.useState<string | null>(DEFAULT_SAMPLE_ID);
  const [paste, setPaste] = React.useState("");
  const [inputError, setInputError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onSelectSample = (id: string) => {
    const s = getSample(id);
    if (!s) return;
    setInputError(null);
    setXml(s.xml);
    setSampleId(id);
  };

  const onApplyPaste = () => {
    if (!paste.trim()) return;
    setInputError(null);
    setXml(paste);
    setSampleId(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const result = validateBpmnFile({ name: file.name, size: file.size });
    if (!result.ok) {
      setInputError(
        result.reason === "extension"
          ? t("bpmnErrExtension")
          : result.reason === "size"
            ? t("bpmnErrSize")
            : t("bpmnErrEmpty"),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInputError(null);
      setXml(String(reader.result ?? ""));
      setSampleId(null);
    };
    reader.onerror = () => setInputError(t("bpmnErrRead"));
    reader.readAsText(file);
  };

  const error = inputError ?? (v.error ? t("bpmnErrImport") : null);

  return (
    <div className="flex flex-col gap-3">
      <ToolEyebrow>{t("bpmnEyebrow")}</ToolEyebrow>

      <ToolIntro
        storageKey="tool-intro:bpmn-viewer"
        question={t("introQuestion")}
        tagline={t("bpmnIntroTagline")}
        concepts={[
          { term: t("bpmnIntroC1t"), desc: t("bpmnIntroC1d") },
          { term: t("bpmnIntroC2t"), desc: t("bpmnIntroC2d") },
          { term: t("bpmnIntroC3t"), desc: t("bpmnIntroC3d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <SectionCard
        title={t("bpmnDiagramTitle")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select defaultValue={DEFAULT_SAMPLE_ID} onValueChange={onSelectSample}>
              <SelectTrigger className="w-48" aria-label={t("bpmnSample")}>
                <SelectValue placeholder={t("bpmnSample")} />
              </SelectTrigger>
              <SelectContent>
                {SAMPLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              {t("bpmnUpload")}
            </Button>
            <input
              ref={fileRef}
              data-testid="bpmn-file-input"
              type="file"
              accept=".bpmn,.xml"
              className="hidden"
              onChange={onFile}
            />

            <div className="flex items-center gap-1 border-l pl-2">
              <Button variant="outline" size="icon" aria-label={t("bpmnZoomIn")} onClick={v.zoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label={t("bpmnZoomOut")} onClick={v.zoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label={t("bpmnReset")} onClick={v.resetZoom}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label={t("bpmnFit")} onClick={v.fitViewport}>
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="px-4 pt-3">
          <FragmentBar>
            ◆{" "}
            {sampleId
              ? t("bpmnStatusSample", { name: getSample(sampleId)?.label ?? sampleId })
              : t("bpmnStatusCustom")}
          </FragmentBar>
        </div>

        {/* dark 模式用 invert+hue-rotate 讓圖轉成「暗底亮線」,避免整塊白底刺眼;
            dark:bg-[#d4d4d4] 反轉後 ≈ #2b2b2b;圖形填色由 BPMN_DARK_CSS 覆寫。 */}
        <style>{BPMN_DARK_CSS}</style>
        <BpmnViewer
          {...v.viewerProps}
          xml={xml}
          ariaLabel={t("bpmnDiagramLabel")}
          className="bpmn-invert mt-3 h-[600px] w-full bg-white dark:bg-[#d4d4d4] dark:invert dark:hue-rotate-180"
        />
      </SectionCard>

      <SectionCard
        title={t("bpmnSourceTitle")}
        action={
          <Button size="sm" onClick={onApplyPaste}>
            {t("bpmnApply")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="bpmn-paste" className="text-sm font-medium">
            {t("bpmnPasteLabel")}
          </label>
          <textarea
            id="bpmn-paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            className="w-full rounded-md border bg-background p-2 font-mono text-xs"
            placeholder="<bpmn:definitions ...>"
          />
        </div>
      </SectionCard>
    </div>
  );
}
