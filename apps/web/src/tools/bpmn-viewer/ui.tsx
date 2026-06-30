"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { BpmnViewer, useBpmnViewer } from "@rfjs/bpmn";
import { Button } from "@rfjs/web-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";

import { SAMPLES, DEFAULT_SAMPLE_ID, getSample } from "./samples";
import { validateBpmnFile } from "./file-input";

export function BpmnViewerTool() {
  const t = useTranslations("ToolUI");
  const v = useBpmnViewer();

  const [xml, setXml] = React.useState(() => getSample(DEFAULT_SAMPLE_ID)?.xml ?? "");
  const [paste, setPaste] = React.useState("");
  const [inputError, setInputError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onSelectSample = (id: string) => {
    const s = getSample(id);
    if (!s) return;
    setInputError(null);
    setXml(s.xml);
  };

  const onApplyPaste = () => {
    if (!paste.trim()) return;
    setInputError(null);
    setXml(paste);
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
    };
    reader.onerror = () => setInputError(t("bpmnErrRead"));
    reader.readAsText(file);
  };

  const error = inputError ?? (v.error ? t("bpmnErrImport") : null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("bpmnEyebrow")}</p>

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

        <div className="ml-auto flex items-center gap-1">
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

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <BpmnViewer
        {...v.viewerProps}
        xml={xml}
        ariaLabel={t("bpmnDiagramLabel")}
        className="h-[600px] w-full rounded-md border bg-card"
      />

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
        <div>
          <Button size="sm" onClick={onApplyPaste}>
            {t("bpmnApply")}
          </Button>
        </div>
      </div>
    </div>
  );
}
