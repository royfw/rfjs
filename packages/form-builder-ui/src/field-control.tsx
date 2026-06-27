'use client';

import * as React from 'react';
import type { FieldConfig } from '@rfjs/form-builder';
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

export interface FieldControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
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

export function FieldControl({ field, value, onChange }: FieldControlProps) {
  switch (field.component) {
    case 'Textarea':
      return (
        <Textarea
          id={field.key}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'Checkbox':
      return (
        <Checkbox
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      );
    case 'Select':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={field.key} className="w-full">
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
    case 'Date':
      return (
        <Input
          id={field.key}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'Number':
      return (
        <Input
          id={field.key}
          type="number"
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'Email':
      return (
        <Input
          id={field.key}
          type="email"
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'Switch':
      return (
        <Switch
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(c === true)}
        />
      );
    case 'Radio':
      return (
        <RadioGroup id={field.key} value={String(value ?? '')} onValueChange={onChange}>
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
    case 'DatePicker':
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button id={field.key} variant="outline">
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
    case 'Input':
    default:
      return (
        <Input
          id={field.key}
          type={field.dataType === 'numeric' ? 'number' : 'text'}
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
