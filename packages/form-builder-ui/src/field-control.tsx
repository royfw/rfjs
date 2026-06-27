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

export interface FieldControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
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
