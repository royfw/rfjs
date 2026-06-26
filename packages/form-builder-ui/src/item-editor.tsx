'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import type { FieldItem, ContentItem, DividerItem, SpacerItem, AiNoteItem, FormItem, SpacerSize } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Textarea } from '@rfjs/web-ui/components/textarea';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import { Button } from '@rfjs/web-ui/components/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@rfjs/web-ui/components/select';
import { FieldItemEditor } from './field-row';
import type { SiblingField } from './field-row';

// ---------------------------------------------------------------------------
// Helpers — locale text for content items
// ---------------------------------------------------------------------------

function contentLocaleText(text: ContentItem['text'], loc: string, fallback: string): string {
  if (typeof text === 'string') return loc === fallback ? text : '';
  return text[loc] ?? '';
}

function setContentLocaleText(
  text: ContentItem['text'],
  loc: string,
  value: string,
  locales: string[],
): ContentItem['text'] {
  const base: Record<string, string> =
    typeof text === 'string' ? { [locales[0] ?? 'en']: text } : { ...text };
  base[loc] = value;
  return base;
}

// ---------------------------------------------------------------------------
// Per-kind body components
// ---------------------------------------------------------------------------

function ContentItemEditor({
  item,
  onUpdate,
  locales = ['en'],
}: {
  item: ContentItem;
  onUpdate: (patch: Partial<ContentItem>) => void;
  locales?: string[];
}) {
  const locked = Boolean(item.locked);
  return (
    <div className="flex flex-col gap-3 border-t border-input p-3">
      <div className="flex flex-col gap-2">
        {locales.map((loc) => (
          <label key={loc} className="flex flex-col gap-1 text-xs text-muted-foreground">
            Text ({loc})
            <Input
              className="h-8"
              aria-label={`content text (${loc})`}
              value={contentLocaleText(item.text, loc, locales[0] ?? 'en')}
              disabled={locked}
              onChange={(e) =>
                onUpdate({ text: setContentLocaleText(item.text, loc, e.target.value, locales) })
              }
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox
          aria-label="locked"
          checked={locked}
          onCheckedChange={(c) => onUpdate({ locked: c === true })}
        />
        locked
      </label>
    </div>
  );
}

function SpacerItemEditor({
  item,
  onUpdate,
}: {
  item: SpacerItem;
  onUpdate: (patch: Partial<SpacerItem>) => void;
}) {
  return (
    <div className="border-t border-input p-3">
      <span className="flex flex-col gap-1 text-xs text-muted-foreground">
        Size
        <Select
          value={item.size ?? 'md'}
          onValueChange={(v) => onUpdate({ size: v as SpacerSize })}
        >
          <SelectTrigger className="h-8 w-[120px]" aria-label="spacer size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">sm</SelectItem>
            <SelectItem value="md">md</SelectItem>
            <SelectItem value="lg">lg</SelectItem>
          </SelectContent>
        </Select>
      </span>
    </div>
  );
}

function AiNoteItemEditor({
  item,
  onUpdate,
}: {
  item: AiNoteItem;
  onUpdate: (patch: Partial<AiNoteItem>) => void;
}) {
  return (
    <div className="border-t border-input p-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Text
        <Textarea
          aria-label="ai-note text"
          value={item.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={3}
        />
      </label>
    </div>
  );
}

function DividerItemBody() {
  return (
    <div className="border-t border-input p-3">
      <p className="text-xs text-muted-foreground">Divider — no properties</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared card header
// ---------------------------------------------------------------------------

function ItemEditorHeader({
  kindLabel,
  onRemove,
}: {
  kindLabel: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2">
      <span className="flex-1 text-xs font-medium text-muted-foreground">{kindLabel}</span>
      <Button type="button" variant="ghost" size="icon" aria-label="remove item" onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public: ItemEditor
// ---------------------------------------------------------------------------

export interface ItemEditorProps {
  item: FormItem;
  siblingFields?: SiblingField[];
  locales?: string[];
  onUpdate: (patch: Partial<FormItem>) => void;
  onRemove: () => void;
}

export function ItemEditor({
  item,
  siblingFields = [],
  locales = ['en'],
  onUpdate,
  onRemove,
}: ItemEditorProps) {
  return (
    <div className="rounded-md border border-input bg-background">
      <ItemEditorHeader kindLabel={item.kind} onRemove={onRemove} />
      {/* Each kind's body owns its own top border + padding (FieldItemEditor included),
          so there is exactly one separator between header and body for every kind. */}
      {item.kind === 'field' ? (
        <FieldItemEditor
          field={item as FieldItem}
          onUpdate={onUpdate as (patch: Partial<FieldItem>) => void}
          locales={locales}
          siblingFields={siblingFields}
        />
      ) : item.kind === 'content' ? (
        <ContentItemEditor
          item={item as ContentItem}
          onUpdate={onUpdate as (patch: Partial<ContentItem>) => void}
          locales={locales}
        />
      ) : item.kind === 'spacer' ? (
        <SpacerItemEditor
          item={item as SpacerItem}
          onUpdate={onUpdate as (patch: Partial<SpacerItem>) => void}
        />
      ) : item.kind === 'ai-note' ? (
        <AiNoteItemEditor
          item={item as AiNoteItem}
          onUpdate={onUpdate as (patch: Partial<AiNoteItem>) => void}
        />
      ) : item.kind === 'divider' ? (
        <DividerItemBody />
      ) : null}
    </div>
  );
}
