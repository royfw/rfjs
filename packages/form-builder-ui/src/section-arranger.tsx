'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { FormConfig, FormSection, FormItem } from '@rfjs/form-builder';
import { normalizeToSections, collectFieldItems } from '@rfjs/form-builder';

import { ItemEditor } from './item-editor';
import type { ConfigBuilderApi } from './use-config-builder';
import { resolveDragEnd } from './arranger-logic';
import type { SiblingField } from './field-row';
import { labelOf } from './field-row';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function siblingFieldsFor(config: FormConfig, excludeId: string): SiblingField[] {
  // collectFieldItems already returns only field items.
  return collectFieldItems(config)
    .filter(
      (f) =>
        f.id !== excludeId &&
        ['string', 'numeric', 'date', 'boolean'].includes(f.dataType),
    )
    .map((f) => ({ key: f.key, label: labelOf(f.label), dataType: f.dataType }));
}

// ---------------------------------------------------------------------------
// SortableItemCard — wraps ItemEditor with dnd-kit sortable handle
// ---------------------------------------------------------------------------

interface SortableItemCardProps {
  item: FormItem;
  config: FormConfig;
  builder: ConfigBuilderApi;
  locales: string[];
}

function SortableItemCard({ item, config, builder, locales }: SortableItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const handle = (
    <button
      type="button"
      className="cursor-grab text-muted-foreground/70 hover:text-foreground"
      aria-label="drag item"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <ItemEditor
        item={item}
        siblingFields={siblingFieldsFor(config, item.id)}
        locales={locales}
        dragHandle={handle}
        onUpdate={(patch) => builder.updateItem(item.id, patch as Partial<FormItem>)}
        onRemove={() => builder.removeItem(item.id)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewRowDropZone — thin droppable strip between/around rows
// ---------------------------------------------------------------------------

interface NewRowDropZoneProps {
  id: string;
}

function NewRowDropZone({ id }: NewRowDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`newrow-zone-${id}`}
      className={`h-2 rounded transition-colors ${isOver ? 'bg-primary/20' : 'bg-transparent'}`}
    />
  );
}

// ---------------------------------------------------------------------------
// RowDropZone — thin droppable strip at the bottom of a row's items.
// Encodes `row:<rowId>` so dropping here appends the dragged item to that row
// (the `row:` branch in resolveDragEnd). Without this the append path is unreachable.
// ---------------------------------------------------------------------------

function RowDropZone({ rowId }: { rowId: string }) {
  const id = `row:${rowId}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`row-zone-${rowId}`}
      className={`mt-1 h-2 rounded transition-colors ${isOver ? 'bg-primary/20' : 'bg-transparent'}`}
    />
  );
}

// ---------------------------------------------------------------------------
// SectionView — one section with sortable rows + new-row zones
// ---------------------------------------------------------------------------

interface SectionViewProps {
  section: FormSection;
  config: FormConfig;
  builder: ConfigBuilderApi;
  locales: string[];
}

function SectionView({ section, config, builder, locales }: SectionViewProps) {
  const itemCount = section.rows.reduce((n, r) => n + r.items.length, 0);
  const title = section.title ? labelOf(section.title) : 'Section';
  return (
    <section className="rounded-lg border bg-card/40">
      <header className="flex items-center gap-2 border-b border-input px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </span>
      </header>
      <div className="flex flex-col gap-0 p-2">
        <NewRowDropZone id={`newrow:${section.id}:0`} />
        {section.rows.map((row, rowIndex) => {
          const itemIds = row.items.map((i) => i.id);
          return (
            <React.Fragment key={row.id}>
              <div className="rounded-md p-1">
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {row.items.map((item) => (
                      <SortableItemCard
                        key={item.id}
                        item={item}
                        config={config}
                        builder={builder}
                        locales={locales}
                      />
                    ))}
                  </div>
                </SortableContext>
                {/* Append-to-row drop zone (`row:<rowId>`). */}
                <RowDropZone rowId={row.id} />
              </div>
              <NewRowDropZone id={`newrow:${section.id}:${rowIndex + 1}`} />
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Public: SectionArranger
// ---------------------------------------------------------------------------

export interface SectionArrangerProps {
  config: FormConfig;
  builder: ConfigBuilderApi;
  locales?: string[];
}

export function SectionArranger({ config, builder, locales = ['en'] }: SectionArrangerProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const sections = normalizeToSections(config);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const next = resolveDragEnd(config, String(active.id), String(over.id));
    if (next !== config) {
      builder.replace(next);
    }
  }

  const allItemIds = sections.flatMap((s) => s.rows).flatMap((r) => r.items.map((i) => i.id));

  return (
    <DndContext id="form-builder-arranger" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {/* Flat SortableContext for all items — dnd-kit needs a single context covering all draggables */}
      <SortableContext items={allItemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <SectionView
              key={section.id}
              section={section}
              config={config}
              builder={builder}
              locales={locales}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
