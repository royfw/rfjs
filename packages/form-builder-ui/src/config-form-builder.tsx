'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { FieldComponent, FormConfig } from '@rfjs/form-builder';
import { parseFormConfig } from '@rfjs/form-builder';
import { Button } from '@rfjs/web-ui/components/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@rfjs/web-ui/components/select';

import { useConfigBuilder } from './use-config-builder';
import { FieldRow, makeField } from './field-row';
import { ConfigForm } from './config-form';

const PALETTE: FieldComponent[] = ['Input', 'Textarea', 'Select', 'Checkbox', 'Date'];
const EMPTY: FormConfig = { version: 1, fields: [] };

export interface ConfigFormBuilderProps {
  initialConfig?: FormConfig;
  onChange?: (config: FormConfig) => void;
  locale?: string;
  locales?: string[];
}

export function ConfigFormBuilder({ initialConfig = EMPTY, onChange, locale = 'en', locales = ['en'] }: ConfigFormBuilderProps) {
  const builder = useConfigBuilder(initialConfig, onChange);
  const sensors = useSensors(useSensor(PointerSensor));
  const ids = builder.config.fields.map((f) => f.key);
  const [tab, setTab] = React.useState<'builder' | 'json'>('builder');
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) builder.move(from, to);
  }

  function onJsonChange(text: string) {
    try {
      const parsed = parseFormConfig(JSON.parse(text));
      setJsonError(null);
      builder.replace(parsed);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid config');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 border-b border-input">
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'builder'}
          className="px-3 py-1.5 text-sm font-medium"
          onClick={() => setTab('builder')}
        >
          Builder
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'json'}
          className="px-3 py-1.5 text-sm font-medium"
          onClick={() => setTab('json')}
        >
          JSON
        </button>
      </div>

      {tab === 'builder' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <Button
                key={c}
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Add ${c}`}
                onClick={() => builder.add(makeField(c))}
              >
                + {c}
              </Button>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              Columns
              <Select
                value={String(builder.config.columns ?? 1)}
                onValueChange={(v) => builder.setColumns(Number(v) as FormConfig['columns'])}
              >
                <SelectTrigger className="h-8" aria-label="columns">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {builder.config.fields.map((field) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    locales={locales}
                    onUpdate={(patch) => builder.update(field.key, patch)}
                    onRemove={() => builder.remove(field.key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div data-testid="config-form-preview" className="rounded-md border border-input p-4">
            <ConfigForm
              config={builder.config}
              locale={locale}
              onSubmit={() => {}}
            />
          </div>
        </>
      ) : (
        <div>
          <textarea
            aria-label="config json"
            className="h-64 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
            defaultValue={JSON.stringify(builder.config, null, 2)}
            onChange={(e) => onJsonChange(e.target.value)}
          />
          {jsonError ? <p className="mt-1 text-xs text-destructive">Invalid config: {jsonError}</p> : null}
        </div>
      )}
    </div>
  );
}
