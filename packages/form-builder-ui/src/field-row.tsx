'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type { FieldComponent, FieldConfig } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import { Button } from '@rfjs/web-ui/components/button';

const DATATYPE_BY_COMPONENT: Record<FieldComponent, FieldConfig['dataType']> = {
  Input: 'string',
  Textarea: 'string',
  Select: 'string',
  Checkbox: 'boolean',
  Date: 'date',
};

let counter = Math.floor(Math.random() * 1_000_000);

export function makeField(component: FieldComponent): FieldConfig {
  counter += 1;
  const base: FieldConfig = {
    key: `field_${counter}`,
    label: component,
    component,
    dataType: DATATYPE_BY_COMPONENT[component],
  };
  return component === 'Select' ? { ...base, options: [] } : base;
}

export interface FieldRowProps {
  field: FieldConfig;
  onUpdate: (patch: Partial<FieldConfig>) => void;
  onRemove: () => void;
}

export function FieldRow({ field, onUpdate, onRemove }: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.key });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const labelText =
    typeof field.label === 'string' ? field.label : (Object.values(field.label)[0] ?? '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-input bg-background p-2"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        aria-label="drag"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="font-mono text-xs text-muted-foreground">{field.component}</span>
      <Input
        className="h-8 flex-1"
        value={labelText}
        aria-label={`label for ${field.key}`}
        onChange={(e) => onUpdate({ label: e.target.value })}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox
          checked={Boolean(field.required)}
          onCheckedChange={(c) => onUpdate({ required: c === true })}
        />
        required
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="remove field"
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
