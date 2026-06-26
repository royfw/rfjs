'use client';

import * as React from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { configToZod, evaluateConditional, resolveLabel, type FormConfig } from '@rfjs/form-builder';
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
    const visible = cfg.fields.filter((f) => evaluateConditional(f.conditional, values as Record<string, unknown>));
    return zodResolver(configToZod({ ...cfg, fields: visible }))(values, ctx, opts);
  }, []);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({ resolver, defaultValues });

  // Re-initialise form state when `config` changes so stale field values are cleared.
  React.useEffect(() => {
    reset(defaultValues ?? {});
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to all form values to decide which fields to RENDER (live show/hide).
  const values = watch();
  const visibleFields = config.fields.filter((f) => evaluateConditional(f.conditional, values as Record<string, unknown>));

  const columns = config.columns ?? 1;

  return (
    <form
      onSubmit={handleSubmit((all) => {
        // Strip hidden fields' values from the submit payload.
        const visible = config.fields.filter((f) => evaluateConditional(f.conditional, all as Record<string, unknown>));
        const keys = new Set(visible.map((f) => f.key));
        const out = Object.fromEntries(Object.entries(all).filter(([k]) => keys.has(k)));
        onSubmit(out as Record<string, unknown>);
      })}
      className="grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(var(--form-cols),minmax(0,1fr))]"
      style={{ '--form-cols': String(columns) } as React.CSSProperties}
      data-columns={columns}
    >
      {visibleFields.map((field) => {
        const width = field.width ?? 'full';
        return (
          <div
            key={field.key}
            className="flex flex-col gap-1.5"
            data-width={width}
            style={width === 'full' ? { gridColumn: '1 / -1' } : undefined}
          >
            <Label htmlFor={field.key}>{resolveLabel(field.label, locale)}</Label>
            <Controller
              control={control}
              name={field.key}
              render={({ field: rhf }) => (
                <FieldControl field={field} value={rhf.value} onChange={rhf.onChange} />
              )}
            />
            {errors[field.key]?.message && (
              <p className="text-xs text-destructive">{String(errors[field.key]?.message)}</p>
            )}
          </div>
        );
      })}
      <div style={{ gridColumn: '1 / -1' }}>
        <Button type="submit" className="self-start">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
