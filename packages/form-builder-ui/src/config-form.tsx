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
} from '@rfjs/form-builder';
import { useDataSource } from './use-data-source';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';

import { FieldControl } from './field-control';

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
   */
  fetcher?: DataSourceFetcher;
}

export function ConfigForm({ config, defaultValues, onSubmit, submitLabel = 'Submit', locale = 'en', fetcher }: ConfigFormProps) {
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

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({ resolver, defaultValues });

  // Re-initialise form state when `config` changes so stale field values are cleared.
  React.useEffect(() => {
    reset(defaultValues ?? {});
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to all form values to decide which items to RENDER (live show/hide).
  const values = watch();

  const spacerHeights: Record<string, number> = { sm: 8, md: 16, lg: 32 };

  // Span styles are applied INLINE, not via Tailwind `col-span-*` utilities —
  // those aren't reliably emitted for this package. Inline is guaranteed.
  // Items always span the full row width.
  const FULL_SPAN: React.CSSProperties = { gridColumn: '1 / -1' };

  // Explicit grid placement → inline grid-area style (grid-mode sections, Task 2).
  const placementStyle = (p: { colStart: number; colSpan: number; row: number; rowSpan?: number }): React.CSSProperties => ({
    gridColumn: `${p.colStart} / span ${p.colSpan}`,
    gridRow: p.rowSpan ? `${p.row} / span ${p.rowSpan}` : String(p.row),
    minWidth: 0,
  });

  // Field grid-span derived from the field's width AND the section's column count.
  // #3: columns DRIVE width — an unset width is a single cell, so a section with
  // `columns: 2` lays its fields two-per-row automatically (no per-field width
  // needed). 'half' ≈ half the row; 'full' spans the whole row. `flow: 'v1'`
  // keeps the legacy behaviour (unset = full) for back-compat with `fields[]`.
  function fieldSpanStyle(width: FieldWidth | undefined, flow: 'v1' | 'section', cols: number): React.CSSProperties {
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
            <FieldControl field={item} value={rhf.value} onChange={rhf.onChange} fetcher={fetcher} locale={locale} />
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

  return (
    <form
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
      className="grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(var(--form-cols),minmax(0,1fr))]"
      style={{ '--form-cols': String(columns) } as React.CSSProperties}
      data-columns={columns}
    >
      {sections.map((section) => {
        // Per-section column count drives the row grid (and thus field widths).
        const sectionCols = section.columns ?? 1;

        if (isV2 && section.layout) {
          const layout = section.layout;
          const byId = new Map(layout.placements.map((p) => [p.itemId, p]));
          const items = section.rows.flatMap((r) => r.items);
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
                style={{ gridColumn: '1 / -1', gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
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
                  style={{ gridColumn: '1 / -1', gridTemplateColumns: `repeat(${sectionCols}, minmax(0, 1fr))` }}
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
          className="self-start border-0 text-white"
          style={{ background: 'linear-gradient(180deg,#5b8cff,#4a78ee)', boxShadow: '0 6px 16px rgba(74,120,238,.3)' }}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
