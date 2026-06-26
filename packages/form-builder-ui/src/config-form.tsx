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
} from '@rfjs/form-builder';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';

import { FieldControl } from './field-control';

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
}

export function ConfigForm({ config, defaultValues, onSubmit, submitLabel = 'Submit', locale = 'en' }: ConfigFormProps) {
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

  // Width is applied via INLINE styles, not Tailwind `basis-*` / `col-span-full`
  // utilities — those aren't reliably emitted for this package, which left preview
  // fields collapsed to their intrinsic width ("not full-width"). Inline is guaranteed.
  // v2 flex row → flex-basis; v1 grid → grid-column span.
  const fullSpan = (flow: 'grid' | 'flex'): React.CSSProperties =>
    flow === 'flex' ? { flexBasis: '100%', minWidth: 0 } : { gridColumn: '1 / -1' };

  function renderItem(item: FormItem, flow: 'grid' | 'flex') {
    const vals = values as Record<string, unknown>;

    if (item.kind === 'ai-note') {
      return null;
    }

    if (item.kind === 'divider') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      return <hr key={item.id} className="w-full border-input" style={fullSpan(flow)} />;
    }

    if (item.kind === 'spacer') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      const height = spacerHeights[item.size ?? 'md'];
      return <div key={item.id} style={{ ...fullSpan(flow), height }} />;
    }

    if (item.kind === 'content') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      return (
        <div key={item.id} className="text-sm" style={fullSpan(flow)}>
          {resolveLabel(item.text, locale)}
        </div>
      );
    }

    // kind === 'field'
    if (!evaluateConditional(item.conditional, vals)) return null;
    const width = item.width ?? 'full';
    const fieldStyle: React.CSSProperties =
      flow === 'flex'
        ? { flexBasis: width === 'full' ? '100%' : 'calc(50% - 0.5rem)', minWidth: 0 }
        : { gridColumn: width === 'full' ? '1 / -1' : undefined };
    return (
      <div key={item.key} className="flex min-w-0 flex-col gap-1.5" data-width={width} style={fieldStyle}>
        <Label htmlFor={item.key}>{resolveLabel(item.label, locale)}</Label>
        <Controller
          control={control}
          name={item.key}
          render={({ field: rhf }) => (
            <FieldControl field={item} value={rhf.value} onChange={rhf.onChange} />
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
      {sections.map((section) => (
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
                className="flex flex-wrap gap-4"
                style={{ gridColumn: '1 / -1' }}
              >
                {row.items.map((item) => renderItem(item, 'flex'))}
              </div>
            ) : (
              // v1 implicit section: render items FLAT into the section grid (unchanged v1 behavior).
              <React.Fragment key={row.id}>
                {row.items.map((item) => renderItem(item, 'grid'))}
              </React.Fragment>
            ),
          )}
        </React.Fragment>
      ))}
      <div style={{ gridColumn: '1 / -1' }}>
        <Button type="submit" className="self-start">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
