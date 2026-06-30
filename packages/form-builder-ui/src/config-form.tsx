'use client';

import * as React from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  configToZod,
  evaluateConditional,
  resolveLabel,
  normalizeToSections,
  collectFieldItems,
  isFieldItem,
  type FormConfig,
  type FormItem,
  type FieldWidth,
  type DataSource,
  type DataSourceFetcher,
  type UploadHandler,
  type SignatureTransport,
} from '@rfjs/form-builder';
import { useDataSource } from './use-data-source';
import { useContainerBreakpoint } from './use-container-breakpoint';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';

import { FieldControl } from './field-control';

// Stable style constant — outside the component so it's never recreated on render.
const FULL_SPAN: React.CSSProperties = { gridColumn: '1 / -1' };

interface DataSourceContentProps {
  ds: DataSource;
  fetcher?: DataSourceFetcher;
}

function DataSourceContent({ ds, fetcher }: DataSourceContentProps) {
  const dsState = useDataSource(ds, fetcher);

  if (dsState.status === 'loading') {
    return <span className="text-muted-foreground">Loading…</span>;
  }

  if (dsState.status === 'ready') {
    const display = dsState.value != null && dsState.value !== '' ? String(dsState.value) : (ds.fallback ?? '無');
    return <span>{display}</span>;
  }

  // idle or error → fallback
  return <span>{ds.fallback ?? '無'}</span>;
}

export interface ConfigFormProps {
  /**
   * `config` drives the form reactively: changing it re-renders the field list and resets
   * the form state (clears stale values for removed/changed fields) without unmounting.
   * The zod resolver is recomputed per `config` so validation tracks the latest schema.
   */
  config: FormConfig;
  defaultValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  submitLabel?: string;
  /** BCP-47 locale used to resolve `LocalizedLabel` field labels. Defaults to `'en'`. */
  locale?: string;
  /**
   * Fetcher for `dataSource` fields (Select/Radio). Receives a `DataSourceRequest` and
   * returns the raw response. Memoize with `useCallback` to avoid unnecessary refetches.
   * When absent, dataSource fields degrade to their fallback text.
   */
  fetcher?: DataSourceFetcher;
  /**
   * Handler for `FileUpload` fields. Receives a `File` and `{ fieldKey }` context
   * and returns a `FileRef`. When absent, FileUpload fields render a disabled fallback.
   * Memoize with `useCallback` to avoid unnecessary re-renders.
   */
  uploadHandler?: UploadHandler;
  /**
   * Transport factory for `Signature` fields. Receives `{ fieldKey, signal }` and
   * returns a `SignatureCaptureHandle`. When absent, the local `<SignaturePad>`
   * drives value directly via `onChange` (no remote capture session).
   * Memoize with `useCallback` to avoid unnecessary session restarts.
   */
  signatureTransport?: SignatureTransport;
}

export function ConfigForm({ config, defaultValues, onSubmit, submitLabel = 'Submit', locale = 'en', fetcher, uploadHandler, signatureTransport }: ConfigFormProps) {
  // Container ref for ResizeObserver-driven responsive collapse.
  const rootRef = React.useRef<HTMLFormElement>(null);
  const stackBelow = config.responsive?.stackBelow ?? 640;
  const narrow = useContainerBreakpoint(rootRef, stackBelow);

  // Keep the latest config reachable inside the stable resolver without re-creating it.
  const configRef = React.useRef(config);
  configRef.current = config;

  // A single STABLE resolver passed once to useForm. RHF calls it at validation time with the
  // current values; it builds the zod schema over ONLY the fields visible for those values, so
  // hidden (e.g. required) fields never block submit. No private internals, no resolver swapping.
  const resolver = React.useCallback<Resolver>((values, ctx, opts) => {
    const cfg = configRef.current;
    const visibleFieldItems = collectFieldItems(cfg).filter((f) =>
      evaluateConditional(f.conditional, values as Record<string, unknown>),
    );
    // Build a minimal config with only the visible field items so configToZod validates them.
    const visibleConfig: FormConfig = { version: cfg.version, fields: visibleFieldItems };
    return zodResolver(configToZod(visibleConfig))(values, ctx, opts);
  }, []);

  const { control, handleSubmit, reset, watch, setError, formState: { errors } } = useForm({ resolver, defaultValues });

  // Track which Signature fields have an active capture in progress — used to
  // gate the submit button while a capture is pending.
  const [pendingCaptures, setPendingCaptures] = React.useState<Set<string>>(new Set());

  const handleSignatureStatus = React.useCallback((fieldKey: string, status: string) => {
    setPendingCaptures((prev) => {
      const next = new Set(prev);
      if (status === 'pending') {
        next.add(fieldKey);
      } else {
        next.delete(fieldKey);
      }
      return next;
    });
  }, []);

  // Re-initialise form state when `config` changes so stale field values are cleared.
  // Also clear pendingCaptures: any Signature fields that were pending will unmount
  // and emit 'idle' via their cleanup, but resetting here is an additional safeguard
  // for in-tree fields that may not unmount (e.g. same key, changed config).
  React.useEffect(() => {
    reset(defaultValues ?? {});
    setPendingCaptures(new Set());
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to all form values to decide which items to RENDER (live show/hide).
  const values = watch();

  const spacerHeights: Record<string, number> = { sm: 8, md: 16, lg: 32 };

  // Span styles are applied INLINE, not via Tailwind `col-span-*` utilities —
  // those aren't reliably emitted for this package. Inline is guaranteed.
  // Items always span the full row width. (FULL_SPAN is module-level — see above.)

  // Explicit grid placement → inline grid-area style (grid-mode sections, Task 2).
  // When narrow, collapse to full width (no placement).
  const placementStyle = (p: { colStart: number; colSpan: number; row: number; rowSpan?: number }): React.CSSProperties =>
    narrow
      ? { ...FULL_SPAN, minWidth: 0 }
      : {
          gridColumn: `${p.colStart} / span ${p.colSpan}`,
          gridRow: p.rowSpan ? `${p.row} / span ${p.rowSpan}` : String(p.row),
          minWidth: 0,
        };

  // Field grid-span derived from the field's width AND the section's column count.
  // #3: columns DRIVE width — an unset width is a single cell, so a section with
  // `columns: 2` lays its fields two-per-row automatically (no per-field width
  // needed). 'half' ≈ half the row; 'full' spans the whole row. `flow: 'v1'`
  // keeps the legacy behaviour (unset = full) for back-compat with `fields[]`.
  function fieldSpanStyle(width: FieldWidth | undefined, flow: 'v1' | 'section', cols: number): React.CSSProperties {
    if (narrow) return FULL_SPAN;
    if (flow === 'v1') return { gridColumn: (width ?? 'full') === 'full' ? '1 / -1' : undefined };
    if (width === 'full') return FULL_SPAN;
    const cells = width === 'half' ? Math.max(1, Math.ceil(cols / 2)) : 1;
    const span = Math.min(cells, cols);
    return { gridColumn: `span ${span} / span ${span}`, minWidth: 0 };
  }

  function renderItem(item: FormItem, flow: 'v1' | 'section', cols: number, place?: { colStart: number; colSpan: number; row: number; rowSpan?: number }) {
    const vals = values as Record<string, unknown>;

    if (item.kind === 'ai-note') {
      return null;
    }

    if (item.kind === 'divider') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      return <hr key={item.id} data-item={item.id} className="w-full border-input" style={place ? placementStyle(place) : FULL_SPAN} />;
    }

    if (item.kind === 'spacer') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      const height = spacerHeights[item.size ?? 'md'];
      return <div key={item.id} data-item={item.id} style={{ ...(place ? placementStyle(place) : FULL_SPAN), height }} />;
    }

    if (item.kind === 'content') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      return (
        <div key={item.id} data-item={item.id} className="text-sm" style={place ? placementStyle(place) : FULL_SPAN}>
          {item.dataSource ? (
            <DataSourceContent ds={item.dataSource} fetcher={fetcher} />
          ) : (
            resolveLabel(item.text, locale)
          )}
        </div>
      );
    }

    // kind === 'field'
    if (!evaluateConditional(item.conditional, vals)) return null;
    // data-width reflects the raw setting: 'auto' (cols-driven) in sections, but
    // the legacy 'full' default in v1 so existing fields[] behaviour is unchanged.
    const dataWidth = item.width ?? (flow === 'v1' ? 'full' : 'auto');
    return (
      <div
        key={item.key}
        className="flex min-w-0 flex-col gap-1.5"
        data-width={dataWidth}
        data-item={item.id}
        style={place ? placementStyle(place) : fieldSpanStyle(item.width, flow, cols)}
      >
        <Label htmlFor={item.key}>{resolveLabel(item.label, locale)}</Label>
        <Controller
          control={control}
          name={item.key}
          render={({ field: rhf }) => (
            <FieldControl
              field={item}
              value={rhf.value}
              onChange={rhf.onChange}
              fetcher={fetcher}
              locale={locale}
              uploadHandler={uploadHandler}
              signatureTransport={signatureTransport}
              onFileError={(key, message) => setError(key, { message })}
              onSignatureStatus={handleSignatureStatus}
            />
          )}
        />
        {errors[item.key]?.message && (
          <p className="text-xs text-destructive">{String(errors[item.key]?.message)}</p>
        )}
      </div>
    );
  }

  const sections = normalizeToSections(config);
  // v1 (fields[]) → flat grid (one field per implicit row); v2 (sections[]) → flex rows.
  const isV2 = config.sections !== undefined;
  // Use the first section's columns for the overall form grid (v1 back-compat).
  const columns = config.columns ?? sections[0]?.columns ?? 1;

  // Pre-sort grid-mode section items once per config+narrow change rather than
  // on every keystroke. `watch()` causes re-renders on every field change, so
  // the sort cost is proportional to input frequency without this memo.
  const sortedGridItems = React.useMemo(() => {
    const result = new Map<string, FormItem[]>();
    for (const section of sections) {
      if (section.layout) {
        const byId = new Map(section.layout.placements.map((p) => [p.itemId, p]));
        const allItems = section.rows.flatMap((r) => r.items);
        result.set(
          section.id,
          narrow
            ? [...allItems].sort((a, b) => {
                const pa = byId.get(a.id);
                const pb = byId.get(b.id);
                return (pa?.row ?? Number.MAX_SAFE_INTEGER) - (pb?.row ?? Number.MAX_SAFE_INTEGER) || (pa?.colStart ?? Number.MAX_SAFE_INTEGER) - (pb?.colStart ?? Number.MAX_SAFE_INTEGER);
              })
            : allItems,
        );
      }
    }
    return result;
  }, [config, narrow]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit((all) => {
        // Strip hidden fields' values from the submit payload.
        const visibleKeys = new Set(
          collectFieldItems(config)
            .filter((f) => evaluateConditional(f.conditional, all as Record<string, unknown>))
            .map((f) => f.key),
        );
        const out = Object.fromEntries(Object.entries(all).filter(([k]) => visibleKeys.has(k)));
        onSubmit(out as Record<string, unknown>);
      })}
      className="grid gap-4"
      style={{
        gridTemplateColumns: narrow ? '1fr' : 'repeat(var(--form-cols), minmax(0, 1fr))',
        ...(!narrow && { ['--form-cols' as any]: String(columns) }),
      }}
      data-columns={columns}
    >
      {sections.map((section) => {
        // Per-section column count drives the row grid (and thus field widths).
        const sectionCols = section.columns ?? 1;

        if (isV2 && section.layout) {
          const layout = section.layout;
          const byId = new Map(layout.placements.map((p) => [p.itemId, p]));
          // Sorted order is pre-computed in sortedGridItems (memoized) to avoid re-sorting
          // on every keystroke (watch() re-renders on each field change).
          const items = sortedGridItems.get(section.id) ?? section.rows.flatMap((r) => r.items);
          return (
            <React.Fragment key={section.id}>
              {section.title && (
                <h3 className="font-semibold text-sm" style={{ gridColumn: '1 / -1' }}>
                  {resolveLabel(section.title, locale)}
                </h3>
              )}
              <div
                data-testid="form-grid"
                className="grid gap-4"
                style={{
                  gridColumn: '1 / -1',
                  gridTemplateColumns: narrow ? '1fr' : `repeat(${layout.columns}, minmax(0, 1fr))`,
                }}
              >
                {items.map((item) => renderItem(item, 'section', layout.columns, byId.get(item.id)))}
              </div>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={section.id}>
            {section.title && (
              <h3 className="font-semibold text-sm" style={{ gridColumn: '1 / -1' }}>
                {resolveLabel(section.title, locale)}
              </h3>
            )}
            {section.rows.map((row) =>
              isV2 ? (
                <div
                  key={row.id}
                  data-testid="form-row"
                  className="grid gap-4"
                  style={{
                    gridColumn: '1 / -1',
                    gridTemplateColumns: narrow ? '1fr' : `repeat(${sectionCols}, minmax(0, 1fr))`,
                  }}
                >
                  {row.items.map((item) => renderItem(item, 'section', sectionCols))}
                </div>
              ) : (
                // v1 implicit section: render items FLAT into the outer grid (unchanged v1 behavior).
                <React.Fragment key={row.id}>
                  {row.items.map((item) => renderItem(item, 'v1', sectionCols))}
                </React.Fragment>
              ),
            )}
          </React.Fragment>
        );
      })}
      <div style={{ gridColumn: '1 / -1' }}>
        <Button
          type="submit"
          disabled={pendingCaptures.size > 0}
          className="self-start border-0 text-white"
          style={{ background: 'linear-gradient(180deg,#5b8cff,#4a78ee)', boxShadow: '0 6px 16px rgba(74,120,238,.3)' }}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
