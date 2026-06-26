'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { configToZod, resolveLabel, type FormConfig } from '@rfjs/form-builder';
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
  const resolver = React.useMemo(() => zodResolver(configToZod(config)), [config]);
  const { control, handleSubmit, reset } = useForm({ resolver, defaultValues });

  // Re-initialise form state when `config` changes so stale field values are cleared.
  // RHF v7 already picks up the new resolver reference on each validation call via _options,
  // so only a reset of values is needed (not a full remount).
  React.useEffect(() => {
    reset(defaultValues ?? {});
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = config.columns ?? 1;

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values as Record<string, unknown>))}
      className="grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(var(--form-cols),minmax(0,1fr))]"
      style={{ '--form-cols': String(columns) } as React.CSSProperties}
      data-columns={columns}
    >
      {config.fields.map((field) => {
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
