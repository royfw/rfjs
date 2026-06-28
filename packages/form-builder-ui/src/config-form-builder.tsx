'use client';

import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import type { FormConfig, FormItem, ItemKind, DataSourceFetcher } from '@rfjs/form-builder';
import { parseFormConfig, normalizeToSections, makeItem } from '@rfjs/form-builder';

import { useConfigBuilder } from './use-config-builder';
import { ConfigForm } from './config-form';
import { SectionArranger } from './section-arranger';

// ---------------------------------------------------------------------------
// useMediaQuery — gate the side-by-side split to wide viewports (RWD).
// Below the breakpoint the builder + preview stack; at/above it they sit
// side-by-side with a draggable divider. Initialised false (SSR-safe), then
// synced on mount.
// ---------------------------------------------------------------------------

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// ---------------------------------------------------------------------------
// Item-kind palette — the new v2 palette adds items by kind.
// "field" is a special kind (adds a new FieldItem); the rest are non-field items.
// ---------------------------------------------------------------------------

const KIND_PALETTE: { kind: ItemKind; label: string }[] = [
  { kind: 'field', label: '+ Field' },
  { kind: 'content', label: '+ Content' },
  { kind: 'divider', label: '+ Divider' },
  { kind: 'spacer', label: '+ Spacer' },
  { kind: 'ai-note', label: '+ AI Note' },
];

const EMPTY: FormConfig = { version: 1, fields: [] };

// Module-level counter for the cold-start (no-rows) branch of addKindItem, so a
// fresh row gets a deterministic, collision-free id even if that path fires more
// than once (e.g. user clears all items then adds again). No Math.random per repo rule.
let initRowSeq = 0;

export interface ConfigFormBuilderProps {
  initialConfig?: FormConfig;
  onChange?: (config: FormConfig) => void;
  locale?: string;
  locales?: string[];
  /**
   * Pluggable fetcher for `dataSource` fields. Passed through to the live preview `<ConfigForm>`.
   * Memoize with `useCallback` (or a module-level const) to avoid re-fetch loops.
   */
  fetcher?: DataSourceFetcher;
}

export function ConfigFormBuilder({ initialConfig = EMPTY, onChange, locale = 'en', locales = ['en'], fetcher }: ConfigFormBuilderProps) {
  const builder = useConfigBuilder(initialConfig, onChange);

  // The form is "empty" only when no items exist at all (covers both v1 fields[] and v2 sections[]).
  const hasItems = normalizeToSections(builder.config).some((s) => s.rows.some((r) => r.items.length > 0));
  const [tab, setTab] = React.useState<'builder' | 'preview' | 'json'>('builder');
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // --- Side-by-side split (Builder tab) -----------------------------------
  // On wide viewports the builder + live preview sit side-by-side with a
  // draggable divider; `splitPct` is the builder column's width (%). Stacks
  // below `lg` (the divider + inline widths are simply not applied).
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [splitPct, setSplitPct] = React.useState(58);
  const splitRef = React.useRef<HTMLDivElement | null>(null);

  function onDividerPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const el = splitRef.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(72, Math.max(34, pct)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  async function copyJson() {
    try {
      await navigator.clipboard?.writeText(JSON.stringify(builder.config, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — no-op */
    }
  }

  /**
   * Add a new item of the given kind into the config.
   * Canonicalizes to sections, then appends into the last row of the first section.
   * If the section has no rows (or doesn't exist yet), builds a new row inline via replace.
   */
  function addKindItem(kind: ItemKind) {
    const item: FormItem = makeItem(kind);
    const sections = normalizeToSections(builder.config);
    const section = sections[0];
    const lastRow = section?.rows[section.rows.length - 1];

    if (section && lastRow) {
      // Happy path: append to the last row of the first section
      builder.addItem(section.id, lastRow.id, item);
    } else {
      // No section yet (v1 empty) or section has no rows — build a minimal sections config.
      // useConfigBuilder.replace fires onChange synchronously, which is what we want.
      // Use a module-level counter for the row id so repeated cold-starts never collide.
      const newRow = { id: `row_init_${(initRowSeq += 1)}`, items: [item] };
      const existingSections = sections.length > 0 ? sections : [{ id: `section_init_${initRowSeq}`, rows: [] }];
      const newSections = existingSections.map((s, i) =>
        i === 0 ? { ...s, rows: [...s.rows, newRow] } : s,
      );
      builder.replace({ version: builder.config.version, sections: newSections });
    }
  }

  function onJsonChange(text: string) {
    try {
      const parsed = parseFormConfig(JSON.parse(text));
      setJsonError(null);
      builder.replace(parsed);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid config');
    }
  }

  // The live-preview panel — reused by the Builder split (right pane) and the
  // dedicated Preview tab (full width), so both stay perfectly in sync.
  const previewPanel = (
    <div data-testid="config-form-preview" className="rounded-xl border border-input bg-card/40 p-5">
      <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
        <span className="size-1.5 rounded-full" style={{ backgroundColor: '#5b8cff' }} />
        Live preview
      </div>
      {!hasItems ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Preview will appear here once you add fields</p>
      ) : (
        <ConfigForm config={builder.config} locale={locale} fetcher={fetcher} onSubmit={() => {}} />
      )}
    </div>
  );

  const TABS = [
    { id: 'builder', label: 'Builder' },
    { id: 'preview', label: 'Preview' },
    { id: 'json', label: 'JSON' },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {/* Segmented tabs (A · technical): Builder | Preview | JSON */}
      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'builder' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {KIND_PALETTE.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                aria-label={label}
                onClick={() => addKindItem(kind)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card/40 px-3 py-1.5 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <span className="font-semibold" style={{ color: '#5b8cff' }}>+</span>
                {label.replace('+ ', '')}
              </button>
            ))}
          </div>

          {/* Side-by-side split: builder (left) + live preview (right). Stacks
              below lg; above lg a draggable divider resizes the two panes. */}
          <div ref={splitRef} className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div
              className="min-w-0"
              style={isWide ? { flexBasis: `${splitPct}%`, flexGrow: 0, flexShrink: 1 } : undefined}
            >
              {!hasItems ? (
                <div className="rounded-xl border border-dashed border-input bg-card/20 py-12 text-center">
                  <p data-testid="empty-state-hint" className="text-sm text-muted-foreground">
                    No items yet — add one from the palette above
                  </p>
                </div>
              ) : (
                <SectionArranger config={builder.config} builder={builder} locales={locales} />
              )}
            </div>

            {/* Draggable divider — wide viewports only. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="resize preview"
              onPointerDown={onDividerPointerDown}
              className="group hidden shrink-0 cursor-col-resize select-none self-stretch px-1 lg:flex lg:items-stretch"
            >
              <div className="h-full w-1.5 rounded-full bg-input transition-colors group-hover:bg-[#5b8cff]" />
            </div>

            <div
              className="min-w-0 lg:sticky lg:top-4"
              style={isWide ? { flexBasis: `${100 - splitPct}%`, flexGrow: 0, flexShrink: 1 } : undefined}
            >
              {previewPanel}
            </div>
          </div>
        </>
      ) : tab === 'preview' ? (
        previewPanel
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
              Config JSON — edits sync back to the builder
            </span>
            <button
              type="button"
              onClick={copyJson}
              aria-label="copy json"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card/40 px-2.5 py-1 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {copied ? <Check className="size-3.5" style={{ color: '#5b8cff' }} /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            aria-label="config json"
            spellCheck={false}
            className="h-[28rem] w-full rounded-md border border-input bg-background p-4 font-mono text-[13px] leading-relaxed"
            defaultValue={JSON.stringify(builder.config, null, 2)}
            onChange={(e) => onJsonChange(e.target.value)}
          />
          {jsonError ? <p className="text-xs text-destructive">Invalid config: {jsonError}</p> : null}
        </div>
      )}
    </div>
  );
}
