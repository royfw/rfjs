"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { parseDataResourceMeta } from "@rfjs/data-schema";
import type { DataFieldMeta, DataResourceMeta } from "@rfjs/data-schema";

import { DEFAULT_META, metaToRows, rowsToMeta, type FieldRow } from "./model";
import { FieldsPanel, type FieldsPanelLabels } from "./fields-panel";
import { ProtocolPanel, type ProtocolPanelLabels } from "@rfjs/data-schema-ui";
import { ImportPanel, type ImportPanelLabels } from "./import-panel";
import { CodePanel, type CodePanelLabels, type CodePanelTab } from "./code-panel";
import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
import { buildMetaAskPrompt, buildNlMetaPrompt, parseNlMetaResponse } from "./ai-nl-meta";
import { ToolIntro } from "@/components/shared/tool-intro";

const STORAGE_KEY = "rfjs.metadata-builder.meta";
const CODE_OPEN_KEY = "rfjs.metadata-builder.code-open";

type Tab = "fields" | "protocol" | "import";

// Assembly shell (design spec §Studio, direction C): eyebrow → segmented tabs (#239 pattern) →
// a two-column grid pairing the current editor panel with the <CodePanel> (or its collapsed
// bar). `meta` is the single source of truth (plan Task 6 sync rule); `rows` is a UI-only
// projection kept in lockstep on every meta-replacing operation (import/reset/restore) via
// metaToRows. `codeTab` is controlled here (not inside CodePanel) so the collapsed bar can keep
// showing the active tab name; `selectedFieldKey` mirrors the fields-panel selection and only
// narrows the code panel while the Fields tab is active.
export function MetadataBuilderTool() {
  const t = useTranslations("ToolUI");
  const locale = useLocale();
  const ai = useAiAssist();
  const aiLabels = useAiPanelLabels();
  const [meta, setMeta] = React.useState<DataResourceMeta>(DEFAULT_META);
  const [tab, setTab] = React.useState<Tab>("fields");
  const [rows, setRows] = React.useState<FieldRow[]>(() => metaToRows(DEFAULT_META.fields, () => crypto.randomUUID()));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [codeTab, setCodeTab] = React.useState<CodePanelTab>("meta");
  const [codeOpen, setCodeOpen] = React.useState(true); // SSR first paint is always open, to avoid a hydration mismatch

  const skipFirstPersistRef = React.useRef(true);
  React.useEffect(() => {
    // 1) restore — must be declared before the persist effect below.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseDataResourceMeta(JSON.parse(raw));
        setMeta(parsed);
        setRows(metaToRows(parsed.fields, () => crypto.randomUUID()));
      }
    } catch {
      /* corrupt storage silently falls back to the default sample */
    }
    const storedOpen = localStorage.getItem(CODE_OPEN_KEY);
    if (storedOpen !== null) {
      setCodeOpen(storedOpen !== "0");
    } else {
      // no stored preference yet: default open on desktop widths, collapsed on narrow viewports.
      // jsdom has no matchMedia — guard it and treat that as "desktop" so tests see the default-open behavior.
      setCodeOpen(typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 1024px)").matches : true);
    }
  }, []);
  React.useEffect(() => {
    // 2) persist — the mount run always carries the pre-restore DEFAULT_META (the restore
    //    effect's setMeta has not been applied yet), so writing here would clobber the stored
    //    meta for one tick; skip exactly that first run. The restore's setMeta (or the first
    //    user edit) triggers the next run with the correct value.
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }, [meta]);

  function toggleCode(next: boolean) {
    setCodeOpen(next);
    localStorage.setItem(CODE_OPEN_KEY, next ? "1" : "0");
  }

  function handleFieldsChange(next: FieldRow[]) {
    setRows(next);
    setMeta((m) => ({ ...m, fields: rowsToMeta(next) }));
  }

  function handleProtocolChange(next: { request: DataResourceMeta["request"]; response: DataResourceMeta["response"] }) {
    setMeta((m) => ({ ...m, request: next.request, response: next.response }));
  }

  function handleImportMeta(nextMeta: DataResourceMeta) {
    setMeta(nextMeta);
    setRows(metaToRows(nextMeta.fields, () => crypto.randomUUID()));
    setTab("fields");
    setSelectedId(null);
  }

  function applyGeneratedMeta(json: string) {
    try {
      handleImportMeta(parseDataResourceMeta(JSON.parse(json)));
    } catch {
      // stale/foreign log entry — leave the current meta untouched
    }
  }

  function handleImportFields(fields: DataFieldMeta[]) {
    setMeta((m) => ({ ...m, fields }));
    setRows(metaToRows(fields, () => crypto.randomUUID()));
    setTab("fields");
    setSelectedId(null);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setMeta(DEFAULT_META);
    setRows(metaToRows(DEFAULT_META.fields, () => crypto.randomUUID()));
    setSelectedId(null);
  }

  const selectedFieldKey = rows.find((r) => r.id === selectedId)?.key ?? null;

  const fieldsLabels: FieldsPanelLabels = React.useMemo(
    () => ({
      key: t("mbKey"),
      labelEn: t("mbLabelEn"),
      labelZh: t("mbLabelZh"),
      dataType: t("mbDataType"),
      format: t("mbFormat"),
      formatNone: t("mbFormatNone"),
      sortable: t("mbSortable"),
      filterable: t("mbFilterable"),
      kind: t("mbKind"),
      kindNone: t("mbKindNone"),
      options: t("mbOptions"),
      addField: t("mbAddField"),
      addOption: t("mbAddOption"),
      remove: t("mbRemove"),
      dupKey: t("mbDupKey"),
      blankKey: t("mbBlankKey"),
      inspectorTitle: t("mbInspectorTitle"),
      inspectorEmpty: t("mbInspectorEmpty"),
      fieldSummary: "",
    }),
    [t],
  );
  // fieldSummary depends on `rows` (which changes far more often than `t`) — computed fresh every
  // render and merged in below, kept out of the [t]-memoized labels object above.
  const fieldSummary = t("mbFieldSummary", { n: rows.length, f: rows.filter((r) => r.filterable).length });

  const protocolLabels: ProtocolPanelLabels = React.useMemo(
    () => ({
      enabled: t("mbProtoEnabled"),
      endpoint: t("mbEndpoint"),
      method: t("mbMethod"),
      pagination: t("mbPagination"),
      sort: t("mbSort"),
      sortNone: t("mbSortNone"),
      filter: t("mbFilter"),
      filterNone: t("mbFilterNone"),
      filterParam: t("mbFilterParam"),
      rowsPath: t("mbRowsPath"),
      totalPath: t("mbTotalPath"),
      cursorPath: t("mbCursorPath"),
      limitParam: t("mbLimitParam"),
      offsetParam: t("mbOffsetParam"),
      pageParam: t("mbPageParam"),
      pageSizeParam: t("mbPageSizeParam"),
      firstPage: t("mbFirstPage"),
      cursorParam: t("mbCursorParam"),
      sortParam: t("mbSortParam"),
      encoding: t("mbEncoding"),
      fieldParam: t("mbFieldParam"),
      dirParam: t("mbDirParam"),
      try: t("mbTry"),
      tryRows: t.raw("mbTryRows") as string,
      tryError: t("mbTryError"),
    }),
    [t],
  );

  const importLabels: ImportPanelLabels = React.useMemo(
    () => ({
      modeMeta: t("mbModeMeta"),
      modeRows: t("mbModeRows"),
      placeholderMeta: t("mbPlaceholderMeta"),
      placeholderRows: t("mbPlaceholderRows"),
      load: t("mbLoad"),
      upload: t("mbUpload"),
      invalidJson: t("mbInvalidJson"),
      hint: t("mbImportHint"),
    }),
    [t],
  );

  const codeLabels: CodePanelLabels = React.useMemo(
    () => ({
      metaTitle: t("mbMetaTitle"),
      schemaTitle: t("mbSchemaTitle"),
      tryTitle: t("mbTryTitle"),
      emptySchema: t("mbEmptySchema"),
      copy: t("mbCopy"),
      copied: t("mbCopied"),
      download: t("mbDownload"),
      reset: t("mbReset"),
      collapse: t("mbCollapse"),
      expand: t("mbExpand"),
      showAll: t("mbShowAll"),
      collapseLabel: t("mbCollapseLabel"),
      viewingField: t("mbViewingField"),
    }),
    [t],
  );
  // shown on the collapsed bar — the active code tab's title, kept in sync without re-deriving
  // the whole codeLabels memo.
  const codeTabLabel = { meta: codeLabels.metaTitle, schema: codeLabels.schemaTitle, try: codeLabels.tryTitle }[codeTab];

  const treeLabels = React.useMemo(
    () => ({
      logic: {
        and: t("mbTreeAnd"),
        or: t("mbTreeOr"),
        nor: t("mbTreeNor"),
        not: t("mbTreeNot"),
      },
      addCondition: t("mbTreeAddCond"),
      addGroup: t("mbTreeAddGroup"),
      removeGroup: t("mbTreeRemoveGroup"),
      removeCondition: t("mbTreeRemoveCond"),
      elemMatch: t("mbTreeElemMatch"),
    }),
    [t],
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: "fields", label: t("mbTabFields") },
    { id: "protocol", label: t("mbTabProtocol") },
    { id: "import", label: t("mbTabImport") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("mbEyebrow")}</p>

      <ToolIntro
        storageKey="tool-intro:metadata-builder"
        question={t("introQuestion")}
        tagline={t("mbIntroTagline")}
        concepts={[
          { term: t("mbIntroC1t"), desc: t("mbIntroC1d") },
          { term: t("mbIntroC2t"), desc: t("mbIntroC2d") },
          { term: t("mbIntroC3t"), desc: t("mbIntroC3d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />

      <AiPanel
        title={t("aiBlockTitle")}
        placeholder={t("mbAiPlaceholder")}
        logKey="rfjs.ai.log.metadata-builder"
        ai={ai}
        labels={aiLabels}
        onReapply={(e) => applyGeneratedMeta(e.appliedJson ?? "")}
        appliedSummary={(e) => {
          let n = 0;
          try {
            const parsed = JSON.parse(e.appliedJson ?? "") as { fields?: unknown[] };
            n = Array.isArray(parsed.fields) ? parsed.fields.length : 0;
          } catch {
            n = 0;
          }
          return t("mbAiApplied", { count: n });
        }}
        actions={[
          {
            key: "generate",
            label: t("mbAiGenerate"),
            needsInput: true,
            primary: true,
            run: async (input) => {
              const out = await ai.run({ ...buildNlMetaPrompt(input, meta), json: true }, parseNlMetaResponse);
              if (out === null) return null;
              applyGeneratedMeta(out);
              return { kind: "generate", prompt: input, appliedJson: out };
            },
          },
          {
            key: "ask",
            label: t("aiAsk"),
            needsInput: true,
            run: async (input) => {
              const out = await ai.runStream(
                buildMetaAskPrompt({ metaJson: JSON.stringify(meta, null, 2), locale }, input),
                (raw) => raw.trim(),
              );
              return out === null ? null : { kind: "ask", prompt: input, answer: out };
            },
          },
        ]}
      />

      {/* 一塊一塊的縱向節奏(比照 form-builder):Editor 區塊卡在上、code panel 區塊卡在下,
          兩塊同語言 —— 頁籤都做在卡片標題列(soft 底、active 金色底線)。 */}
      <div className="min-w-0 overflow-hidden rounded-md border">
        <div className="flex items-stretch border-b bg-muted/30">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              aria-selected={tab === tabItem.id}
              className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                tab === tabItem.id
                  ? "bg-card font-semibold text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "fields" && (
            <FieldsPanel
              rows={rows}
              onChange={handleFieldsChange}
              selectedId={selectedId}
              onSelect={setSelectedId}
              labels={{ ...fieldsLabels, fieldSummary }}
            />
          )}
          {tab === "protocol" && (
            <ProtocolPanel request={meta.request} response={meta.response} onChange={handleProtocolChange} labels={protocolLabels} />
          )}
          {tab === "import" && <ImportPanel onMeta={handleImportMeta} onFields={handleImportFields} labels={importLabels} />}
        </div>
      </div>

      <div className="min-w-0">
        {codeOpen ? (
          <CodePanel
            meta={meta}
            selectedFieldKey={tab === "fields" ? selectedFieldKey : null}
            tab={codeTab}
            onTabChange={setCodeTab}
            onReset={reset}
            onCollapse={() => toggleCode(false)}
            labels={codeLabels}
            treeLabels={treeLabels}
          />
        ) : (
          <button
            type="button"
            onClick={() => toggleCode(true)}
            aria-label={t("mbExpand")}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:text-foreground"
          >
            {codeTabLabel}
          </button>
        )}
      </div>
    </div>
  );
}
