'use client';

import * as React from 'react';
import type { FieldConfig, DataSourceFetcher } from '@rfjs/form-builder';
import { resolveLabel } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Textarea } from '@rfjs/web-ui/components/textarea';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rfjs/web-ui/components/select';
import { Switch } from '@rfjs/web-ui/components/switch';
import { RadioGroup, RadioGroupItem } from '@rfjs/web-ui/components/radio-group';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@rfjs/web-ui/components/popover';
import { Calendar } from '@rfjs/web-ui/components/calendar';
import { TagInput } from '@rfjs/web-ui/components/tag-input';
import { useDataSource } from './use-data-source';

export interface FieldControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  fetcher?: DataSourceFetcher;
  /** BCP-47 locale for resolving LocalizedLabel descriptions. Defaults to 'en'. */
  locale?: string;
}

/** Format a Date as a LOCAL `yyyy-mm-dd` ISO string (no UTC shift). */
export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a `yyyy-mm-dd` ISO string into a LOCAL-midnight Date (no UTC shift). */
export function isoToDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

// --- Sub-components for controls that use hooks ---

interface SelectControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  fetcher?: DataSourceFetcher;
}

function SelectControl({ field, value, onChange, fetcher }: SelectControlProps) {
  // Hook ALWAYS called unconditionally — returns idle when ds or fetcher is absent.
  const dsState = useDataSource(field.dataSource, fetcher);

  const effectiveDisabled = field.disabled || field.readOnly;
  const ariaReadonly = field.readOnly || undefined;

  if (field.dataSource) {
    if (dsState.status === 'loading') {
      return (
        <Select disabled>
          <SelectTrigger id={field.key} className="w-full">
            <SelectValue placeholder="Loading…" />
          </SelectTrigger>
          <SelectContent />
        </Select>
      );
    }
    if (dsState.status === 'ready' && dsState.options.length > 0) {
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger
            id={field.key}
            className="w-full"
            disabled={effectiveDisabled}
            aria-readonly={ariaReadonly}
          >
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {dsState.options.map((opt) => (
              <SelectItem key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    // error, idle (no fetcher), or ready with empty options → fallback
    return (
      <span className="text-sm text-muted-foreground">
        {field.dataSource.fallback ?? '無'}
      </span>
    );
  }

  // No dataSource → static options (unchanged behavior)
  return (
    <Select value={(value as string) ?? ''} onValueChange={onChange}>
      <SelectTrigger
        id={field.key}
        className="w-full"
        disabled={effectiveDisabled}
        aria-readonly={ariaReadonly}
      >
        <SelectValue placeholder={field.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {(field.options ?? []).map((opt) => (
          <SelectItem key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface RadioControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  fetcher?: DataSourceFetcher;
}

function RadioControl({ field, value, onChange, fetcher }: RadioControlProps) {
  // Hook ALWAYS called unconditionally — returns idle when ds or fetcher is absent.
  const dsState = useDataSource(field.dataSource, fetcher);

  const effectiveDisabled = field.disabled || field.readOnly;
  const ariaReadonly = field.readOnly || undefined;

  if (field.dataSource) {
    if (dsState.status === 'loading') {
      return <p className="text-sm text-muted-foreground">Loading…</p>;
    }
    if (dsState.status === 'ready' && dsState.options.length > 0) {
      return (
        <RadioGroup
          id={field.key}
          value={String(value ?? '')}
          onValueChange={onChange}
          disabled={effectiveDisabled}
          aria-readonly={ariaReadonly}
        >
          {dsState.options.map((opt) => (
            <div key={String(opt.value)} className="flex items-center gap-2">
              <RadioGroupItem
                value={String(opt.value)}
                id={`${field.key}-${opt.value}`}
              />
              <Label htmlFor={`${field.key}-${opt.value}`}>{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    }
    // error, idle, or ready with empty options → fallback
    return (
      <span className="text-sm text-muted-foreground">
        {field.dataSource.fallback ?? '無'}
      </span>
    );
  }

  // No dataSource → static options (unchanged behavior)
  return (
    <RadioGroup
      id={field.key}
      value={String(value ?? '')}
      onValueChange={onChange}
      disabled={effectiveDisabled}
      aria-readonly={ariaReadonly}
    >
      {(field.options ?? []).map((opt) => (
        <div key={String(opt.value)} className="flex items-center gap-2">
          <RadioGroupItem
            value={String(opt.value)}
            id={`${field.key}-${opt.value}`}
          />
          <Label htmlFor={`${field.key}-${opt.value}`}>{opt.label}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}

// --- Main FieldControl ---

export function FieldControl({ field, value, onChange, fetcher, locale = 'en' }: FieldControlProps) {
  const disabled = field.disabled;
  const readOnly = field.readOnly;
  // Radix controls have no readOnly — treat readOnly as disabled for interaction,
  // but signal the semantic via aria-readonly so assistive tech reports it correctly.
  const effectiveDisabled = disabled || readOnly;
  const ariaReadonly = readOnly || undefined;

  let control: React.ReactNode;

  switch (field.component) {
    case 'Textarea':
      control = (
        <Textarea
          id={field.key}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Checkbox':
      control = (
        <Checkbox
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={effectiveDisabled}
          aria-readonly={ariaReadonly}
        />
      );
      break;
    case 'Select':
      control = <SelectControl field={field} value={value} onChange={onChange} fetcher={fetcher} />;
      break;
    case 'Date':
      control = (
        <Input
          id={field.key}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Number':
      control = (
        <Input
          id={field.key}
          type="number"
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Email':
      control = (
        <Input
          id={field.key}
          type="email"
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Switch':
      control = (
        <Switch
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(c === true)}
          disabled={effectiveDisabled}
          aria-readonly={ariaReadonly}
        />
      );
      break;
    case 'Radio':
      control = <RadioControl field={field} value={value} onChange={onChange} fetcher={fetcher} />;
      break;
    case 'DatePicker':
      control = (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={field.key}
              variant="outline"
              disabled={effectiveDisabled}
              aria-readonly={ariaReadonly}
            >
              {(value as string) || (field.placeholder ?? 'Pick a date')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={isoToDate(value as string)}
              onSelect={(d) => onChange(d ? dateToISO(d) : '')}
            />
          </PopoverContent>
        </Popover>
      );
      break;
    case 'CheckboxGroup': {
      const arr = (value as string[]) ?? [];
      control = (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => (
            <div key={String(opt.value)} className="flex items-center gap-2">
              <Checkbox
                id={`${field.key}-${opt.value}`}
                checked={arr.includes(String(opt.value))}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    onChange([...arr, String(opt.value)]);
                  } else {
                    onChange(arr.filter((v) => v !== String(opt.value)));
                  }
                }}
                disabled={effectiveDisabled}
                aria-readonly={ariaReadonly}
              />
              <Label htmlFor={`${field.key}-${opt.value}`}>{opt.label}</Label>
            </div>
          ))}
        </div>
      );
      break;
    }
    case 'TagList':
      control = (
        <TagInput
          id={field.key}
          value={(value as string[]) ?? []}
          onChange={(next) => onChange(next)}
          options={field.options?.map((opt) => ({
            label: String(opt.label),
            value: String(opt.value),
          }))}
          creatable={field.creatable}
          disabled={effectiveDisabled}
          placeholder={field.placeholder}
        />
      );
      break;
    case 'Input':
    default:
      control = (
        <Input
          id={field.key}
          type={field.dataType === 'numeric' ? 'number' : 'text'}
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
  }

  const descText = field.description ? resolveLabel(field.description, locale) : undefined;

  return (
    <>
      {control}
      {descText && <p className="text-xs text-muted-foreground">{descText}</p>}
    </>
  );
}
