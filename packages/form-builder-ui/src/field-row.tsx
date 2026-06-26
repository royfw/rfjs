'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import type { FieldComponent, FieldConfig, FieldOption, FieldValidation, FieldWidth, ConditionalRule } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Textarea } from '@rfjs/web-ui/components/textarea';
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

export function labelOf(label: FieldConfig['label']): string {
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

/**
 * Merge a single validation field into the existing validation object.
 * For numeric keys an empty/`NaN` parse CLEARS the key (never stores `NaN`);
 * for string keys an empty value CLEARS the key.
 */
export function mergeValidation(
  current: FieldValidation | undefined,
  key: keyof FieldValidation,
  raw: string,
  numeric: boolean,
): FieldValidation {
  const next: FieldValidation = { ...current };
  if (numeric) {
    const n = raw === '' ? undefined : Number(raw);
    if (n === undefined || Number.isNaN(n)) {
      delete next[key];
    } else {
      (next as Record<string, unknown>)[key] = n;
    }
  } else if (raw === '') {
    delete next[key];
  } else {
    (next as Record<string, unknown>)[key] = raw;
  }
  return next;
}

function ValidationEditor({ field, onUpdate }: { field: FieldConfig; onUpdate: (patch: Partial<FieldConfig>) => void }) {
  const v = field.validation ?? {};

  function patchValidation(key: keyof FieldValidation, raw: string, numeric: boolean) {
    onUpdate({ validation: mergeValidation(v, key, raw, numeric) });
  }

  // Fields with `options` (enum/Select) ignore numeric/length/pattern bounds in the
  // engine's applyValidation, so don't offer dead controls for them.
  const hasOptions = Boolean(field.options?.length);
  const isNumeric = field.dataType === 'numeric' && !hasOptions;
  const isStringOrDate = (field.dataType === 'string' || field.dataType === 'date') && !hasOptions;

  // The `message` input only matters when at least one constraint block applies.
  if (!isNumeric && !isStringOrDate) return null;

  return (
    <div className="col-span-full flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Validation</span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
        {isNumeric ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Min
              <Input
                className="h-8"
                type="number"
                aria-label="validation min"
                value={v.min ?? ''}
                onChange={(e) => patchValidation('min', e.target.value, true)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Max
              <Input
                className="h-8"
                type="number"
                aria-label="validation max"
                value={v.max ?? ''}
                onChange={(e) => patchValidation('max', e.target.value, true)}
              />
            </label>
          </>
        ) : null}
        {isStringOrDate ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Min length
              <Input
                className="h-8"
                type="number"
                aria-label="validation minLength"
                value={v.minLength ?? ''}
                onChange={(e) => patchValidation('minLength', e.target.value, true)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Max length
              <Input
                className="h-8"
                type="number"
                aria-label="validation maxLength"
                value={v.maxLength ?? ''}
                onChange={(e) => patchValidation('maxLength', e.target.value, true)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground col-span-2">
              Pattern
              <Input
                className="h-8"
                aria-label="validation pattern"
                value={v.pattern ?? ''}
                onChange={(e) => patchValidation('pattern', e.target.value, false)}
              />
            </label>
          </>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground col-span-full">
          Message
          <Input
            className="h-8"
            aria-label="validation message"
            value={v.message ?? ''}
            onChange={(e) => patchValidation('message', e.target.value, false)}
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conditional display — pure helpers (exported for direct unit-testing)
// ---------------------------------------------------------------------------

/** A sibling field descriptor used to populate the condition-row field select. */
export type SiblingField = { key: string; label: string; dataType: FieldConfig['dataType'] };

/** Operators available per scalar dataType. */
export function operatorsFor(dataType: FieldConfig['dataType']): string[] {
  if (dataType === 'numeric' || dataType === 'date') {
    return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
  }
  if (dataType === 'boolean') {
    return ['eq', 'neq'];
  }
  // string (default)
  return ['eq', 'neq', 'contains', 'startswith', 'endswith'];
}

/**
 * Coerce a raw string value from an <Input> to the correct JS type for the given dataType.
 * numeric → Number (NaN → '' rather than storing NaN); boolean → `raw === 'true'`; string/date → raw.
 */
export function coerceConditionValue(raw: string, dataType: FieldConfig['dataType']): string | number | boolean {
  if (dataType === 'numeric') {
    if (raw === '') return '';
    const n = Number(raw);
    return Number.isNaN(n) ? '' : n;
  }
  if (dataType === 'boolean') {
    return raw === 'true';
  }
  return raw;
}

/** Build a fresh condition row for a given sibling field. */
export function defaultCondition(sibling: SiblingField): { field: string; dataType: FieldConfig['dataType']; operator: string; value: string | number | boolean } {
  return { field: sibling.key, dataType: sibling.dataType, operator: 'eq', value: '' };
}

/** Append a new condition row for `sibling` to the group (or create the group). */
export function addCondition(
  group: ConditionalRule | undefined,
  sibling: SiblingField,
): ConditionalRule {
  const base = group ?? { logic: 'and' as const, filters: [] };
  return { ...base, filters: [...base.filters, defaultCondition(sibling) as never] };
}

/** Remove condition row at index `i`. */
export function removeCondition(group: ConditionalRule, i: number): ConditionalRule {
  return { ...group, filters: group.filters.filter((_, j) => j !== i) };
}

/** Change the field + dataType for condition row `i`; resets operator to `eq` and clears value. */
export function setConditionField(group: ConditionalRule, i: number, sibling: SiblingField): ConditionalRule {
  return {
    ...group,
    filters: group.filters.map((f, j) =>
      j === i ? { field: sibling.key, dataType: sibling.dataType, operator: 'eq', value: '' } as never : f,
    ),
  };
}

/** Change the operator for condition row `i`. */
export function setConditionOperator(group: ConditionalRule, i: number, op: string): ConditionalRule {
  return {
    ...group,
    filters: group.filters.map((f, j) =>
      j === i ? { ...(f as object), operator: op } as never : f,
    ),
  };
}

/** Change the value for condition row `i`, coercing by dataType. */
export function setConditionValue(group: ConditionalRule, i: number, raw: string, dataType: FieldConfig['dataType']): ConditionalRule {
  return {
    ...group,
    filters: group.filters.map((f, j) =>
      j === i ? { ...(f as object), value: coerceConditionValue(raw, dataType) } as never : f,
    ),
  };
}

// A loose leaf shape used only inside this editor (not the full discriminated union).
type ConditionRow = { field: string; dataType: FieldConfig['dataType']; operator: string; value: string | number | boolean };

function ConditionalEditor({
  field,
  siblingFields,
  onUpdate,
}: {
  field: FieldConfig;
  siblingFields: SiblingField[];
  onUpdate: (patch: Partial<FieldConfig>) => void;
}) {
  const enabled = Boolean(field.conditional);
  const group = field.conditional;

  function toggle(checked: boolean | 'indeterminate') {
    if (checked === true) {
      onUpdate({ conditional: { logic: 'and', filters: [] } });
    } else {
      onUpdate({ conditional: undefined });
    }
  }

  const rows = (group?.filters ?? []) as ConditionRow[];

  return (
    <div className="col-span-full flex flex-col gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox
          aria-label="enable conditional display"
          checked={enabled}
          onCheckedChange={toggle}
        />
        Only show when conditions match
      </label>
      {enabled && group ? (
        <div className="flex flex-col gap-2 pl-5">
          {rows.map((row, i) => {
            const ops = operatorsFor(row.dataType ?? 'string');
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                {/* Field select */}
                <Select
                  value={row.field}
                  onValueChange={(v) => {
                    const sib = siblingFields.find((s) => s.key === v);
                    if (sib) onUpdate({ conditional: setConditionField(group, i, sib) });
                  }}
                >
                  <SelectTrigger className="h-8 min-w-[120px]" aria-label={`condition ${i} field`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {siblingFields.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Operator select */}
                <Select
                  value={row.operator}
                  onValueChange={(v) => onUpdate({ conditional: setConditionOperator(group, i, v) })}
                >
                  <SelectTrigger className="h-8 min-w-[100px]" aria-label={`condition ${i} operator`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ops.map((op) => (
                      <SelectItem key={op} value={op}>{op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Value input */}
                <Input
                  className="h-8 min-w-[100px] flex-1"
                  aria-label={`condition ${i} value`}
                  value={String(row.value)}
                  onChange={(e) => onUpdate({ conditional: setConditionValue(group, i, e.target.value, row.dataType ?? 'string') })}
                />
                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`remove condition ${i}`}
                  onClick={() => onUpdate({ conditional: removeCondition(group, i) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
          {siblingFields.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => onUpdate({ conditional: addCondition(group, siblingFields[0]!) })}
            >
              + Add condition
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">No other fields available to condition on.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function localeText(label: FieldConfig['label'], loc: string, fallback: string): string {
  if (typeof label === 'string') return loc === fallback ? label : '';
  return label[loc] ?? '';
}

export function setLocaleLabel(label: FieldConfig['label'], loc: string, value: string, locales: string[]): FieldConfig['label'] {
  const base: Record<string, string> = typeof label === 'string' ? { [locales[0] ?? 'en']: label } : { ...label };
  base[loc] = value;
  return base;
}

export interface FieldItemEditorProps {
  field: FieldConfig & { aiNote?: string };
  onUpdate: (patch: Partial<FieldConfig & { aiNote?: string }>) => void;
  locales?: string[];
  siblingFields?: SiblingField[];
}

/**
 * The expanded editor body for a field item.
 * Extracted so it can be reused by both FieldRow and ItemEditor.
 */
export function FieldItemEditor({ field, onUpdate, locales = ['en'], siblingFields = [] }: FieldItemEditorProps) {
  const [keyDraft, setKeyDraft] = React.useState(field.key);
  React.useEffect(() => setKeyDraft(field.key), [field.key]);

  function changeComponent(component: FieldComponent) {
    onUpdate({
      component,
      dataType: DATATYPE_BY_COMPONENT[component],
      options: component === 'Select' ? (field.options ?? []) : undefined,
    });
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 border-t border-input p-3">
      <span className="flex flex-col gap-1 text-xs text-muted-foreground">
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
      </span>
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
      <span className="flex flex-col gap-1 text-xs text-muted-foreground">
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
      </span>
      <label className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
        <Checkbox
          aria-label="required"
          checked={Boolean(field.required)}
          onCheckedChange={(c) => onUpdate({ required: c === true })}
        />
        required
      </label>
      {field.component === 'Select' ? <OptionsEditor field={field} onUpdate={onUpdate} /> : null}
      <ValidationEditor field={field} onUpdate={onUpdate} />
      <ConditionalEditor field={field} siblingFields={siblingFields} onUpdate={onUpdate} />
      <label className="col-span-full flex flex-col gap-1 text-xs text-muted-foreground">
        AI note
        <Textarea
          aria-label="AI note for field"
          value={field.aiNote ?? ''}
          onChange={(e) => onUpdate({ aiNote: e.target.value })}
          rows={2}
        />
      </label>
    </div>
  );
}

export interface FieldRowProps {
  field: FieldConfig;
  onUpdate: (patch: Partial<FieldConfig>) => void;
  onRemove: () => void;
  locales?: string[];
  siblingFields?: SiblingField[];
}

export function FieldRow({ field, onUpdate, onRemove, locales = ['en'], siblingFields = [] }: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.key });
  const [open, setOpen] = React.useState(true);
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

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
        <FieldItemEditor field={field} onUpdate={onUpdate} locales={locales} siblingFields={siblingFields} />
      ) : null}
    </div>
  );
}
