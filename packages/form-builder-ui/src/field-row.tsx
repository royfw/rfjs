'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import type { FieldComponent, FieldConfig, FieldOption, FieldWidth } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import { Button } from '@rfjs/web-ui/components/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@rfjs/web-ui/components/select';

const DATATYPE_BY_COMPONENT: Record<FieldComponent, FieldConfig['dataType']> = {
  Input: 'string',
  Textarea: 'string',
  Select: 'string',
  Checkbox: 'boolean',
  Date: 'date',
};

const COMPONENTS: FieldComponent[] = ['Input', 'Textarea', 'Select', 'Checkbox', 'Date'];

function labelOf(label: FieldConfig['label']): string {
  return typeof label === 'string' ? label : (Object.values(label)[0] ?? '');
}

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

function OptionsEditor({ field, onUpdate }: { field: FieldConfig; onUpdate: (patch: Partial<FieldConfig>) => void }) {
  const options = field.options ?? [];
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  const set = (next: FieldOption[]) => onUpdate({ options: next });
  return (
    <div className="col-span-full flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Options</span>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="h-8"
            aria-label={`option ${i} label`}
            value={opt.label}
            onChange={(e) => set(optionsRef.current.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))}
          />
          <Input
            className="h-8"
            aria-label={`option ${i} value`}
            value={String(opt.value)}
            onChange={(e) => set(optionsRef.current.map((o, j) => (j === i ? { ...o, value: e.target.value } : o)))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`remove option ${i}`}
            onClick={() => set(optionsRef.current.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => set([...optionsRef.current, { label: '', value: '' }])}
      >
        + Add option
      </Button>
    </div>
  );
}

function localeText(label: FieldConfig['label'], loc: string, fallback: string): string {
  if (typeof label === 'string') return loc === fallback ? label : '';
  return label[loc] ?? '';
}

function setLocaleLabel(label: FieldConfig['label'], loc: string, value: string, locales: string[]): FieldConfig['label'] {
  const base: Record<string, string> = typeof label === 'string' ? { [locales[0] ?? 'en']: label } : { ...label };
  base[loc] = value;
  return base;
}

export interface FieldRowProps {
  field: FieldConfig;
  onUpdate: (patch: Partial<FieldConfig>) => void;
  onRemove: () => void;
  locales?: string[];
}

export function FieldRow({ field, onUpdate, onRemove, locales = ['en'] }: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.key });
  const [open, setOpen] = React.useState(true);
  const [keyDraft, setKeyDraft] = React.useState(field.key);
  React.useEffect(() => setKeyDraft(field.key), [field.key]);
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  function changeComponent(component: FieldComponent) {
    onUpdate({
      component,
      dataType: DATATYPE_BY_COMPONENT[component],
      options: component === 'Select' ? (field.options ?? []) : undefined,
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border border-input bg-background">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
          aria-label={open ? 'collapse field' : 'expand field'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
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
        <span className="flex-1 truncate text-sm">{labelOf(field.label)}</span>
        {field.required ? <span className="text-xs text-destructive">required</span> : null}
        <Button type="button" variant="ghost" size="icon" aria-label="remove field" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {open ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 border-t border-input p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Type
            <Select value={field.component} onValueChange={(v) => changeComponent(v as FieldComponent)}>
              <SelectTrigger className="h-8" aria-label={`type for ${field.key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPONENTS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Key
            <Input
              className="h-8 font-mono"
              aria-label={`key for ${field.key}`}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onBlur={() => { if (keyDraft && keyDraft !== field.key) onUpdate({ key: keyDraft }); }}
            />
          </label>
          {locales.length <= 1 ? (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Label
              <Input
                className="h-8"
                aria-label={`label for ${field.key}`}
                value={labelOf(field.label)}
                onChange={(e) => onUpdate({ label: e.target.value })}
              />
            </label>
          ) : (
            locales.map((loc) => (
              <label key={loc} className="flex flex-col gap-1 text-xs text-muted-foreground">
                Label ({loc})
                <Input
                  className="h-8"
                  aria-label={`label (${loc}) for ${field.key}`}
                  value={localeText(field.label, loc, locales[0] ?? 'en')}
                  onChange={(e) => onUpdate({ label: setLocaleLabel(field.label, loc, e.target.value, locales) })}
                />
              </label>
            ))
          )}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Width
            <Select value={field.width ?? 'full'} onValueChange={(v) => onUpdate({ width: v as FieldWidth })}>
              <SelectTrigger className="h-8" aria-label={`width for ${field.key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="half">Half</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
            <Checkbox
              checked={Boolean(field.required)}
              onCheckedChange={(c) => onUpdate({ required: c === true })}
            />
            required
          </label>
          {field.component === 'Select' ? <OptionsEditor field={field} onUpdate={onUpdate} /> : null}
        </div>
      ) : null}
    </div>
  );
}
