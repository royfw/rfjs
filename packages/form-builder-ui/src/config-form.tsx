'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { configToZod, type FormConfig } from '@rfjs/form-builder';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';

import { FieldControl } from './field-control';

export interface ConfigFormProps {
  /**
   * `config` is read once at mount (react-hook-form does not re-initialise from a changed resolver);
   * remount with a React `key` to swap configs at runtime.
   */
  config: FormConfig;
  defaultValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  submitLabel?: string;
}

export function ConfigForm({ config, defaultValues, onSubmit, submitLabel = 'Submit' }: ConfigFormProps) {
  const resolver = React.useMemo(() => zodResolver(configToZod(config)), [config]);
  const { control, handleSubmit } = useForm({ resolver, defaultValues });

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
            <Label htmlFor={field.key}>{field.label}</Label>
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
