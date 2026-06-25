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
import { Button } from '@rfjs/web-ui/components/button';

import { useConfigBuilder } from './use-config-builder';
import { FieldRow, makeField } from './field-row';
import { ConfigForm } from './config-form';

const PALETTE: FieldComponent[] = ['Input', 'Textarea', 'Select', 'Checkbox', 'Date'];
const EMPTY: FormConfig = { version: 1, fields: [] };

export interface ConfigFormBuilderProps {
  initialConfig?: FormConfig;
  onChange?: (config: FormConfig) => void;
  locale?: string;
}

export function ConfigFormBuilder({ initialConfig = EMPTY, onChange, locale = 'en' }: ConfigFormBuilderProps) {
  const builder = useConfigBuilder(initialConfig, onChange);
  const sensors = useSensors(useSensor(PointerSensor));
  const ids = builder.config.fields.map((f) => f.key);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) builder.move(from, to);
  }

  return (
    <div className="flex flex-col gap-5">
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
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {builder.config.fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                onUpdate={(patch) => builder.update(field.key, patch)}
                onRemove={() => builder.remove(field.key)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div data-testid="config-form-preview" className="rounded-md border border-input p-4">
        <ConfigForm
          key={JSON.stringify(builder.config)}
          config={builder.config}
          locale={locale}
          onSubmit={() => {}}
        />
      </div>
    </div>
  );
}
