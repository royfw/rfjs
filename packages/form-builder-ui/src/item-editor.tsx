'use client';

import * as React from 'react';
import {
  Trash2,
  ChevronRight,
  ChevronDown,
  Type,
  AlignLeft,
  Minus,
  MoveVertical,
  Sparkles,
} from 'lucide-react';
import type { FieldItem, ContentItem, DividerItem, SpacerItem, AiNoteItem, FormItem, ItemKind, SpacerSize } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Textarea } from '@rfjs/web-ui/components/textarea';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import { Button } from '@rfjs/web-ui/components/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@rfjs/web-ui/components/select';
import { FieldItemEditor, labelOf } from './field-row';
import type { SiblingField } from './field-row';

// ---------------------------------------------------------------------------
// Kind metadata — icon, label, and accent colors per item kind. The left
// accent bar + icon chip give each kind an at-a-glance identity (matches mockup).
// ---------------------------------------------------------------------------

interface KindMeta {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string; // kind accent color (inline — not dependent on the web-ui palette)
}

const KIND_META: Record<ItemKind, KindMeta> = {
  field: { label: 'Field', Icon: Type, color: '#0ea5e9' }, // sky
  content: { label: 'Content', Icon: AlignLeft, color: '#8b5cf6' }, // violet
  'ai-note': { label: 'AI Note', Icon: Sparkles, color: '#d946ef' }, // fuchsia
  divider: { label: 'Divider', Icon: Minus, color: '#71717a' }, // zinc
  spacer: { label: 'Spacer', Icon: MoveVertical, color: '#71717a' },
};

const PILL_COLORS: Record<string, string> = {
  danger: '#ef4444',
  warn: '#f59e0b',
  accent: '#8b5cf6',
};

function Pill({ tone = 'accent', children }: { tone?: 'danger' | 'warn' | 'accent'; children: React.ReactNode }) {
  const c = PILL_COLORS[tone];
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
      style={{ backgroundColor: `${c}22`, color: c }}
    >
      {children}
    </span>
  );
}

/** One-line summary shown in the collapsed header for each kind. */
function itemSummary(item: FormItem): { title: string; meta?: string } {
  switch (item.kind) {
    case 'field':
      return { title: labelOf(item.label) || item.key, meta: `${item.key} · ${item.component}` };
    case 'content':
      return { title: labelOf(item.text) || 'Content block', meta: 'content' };
    case 'ai-note':
      return { title: item.text || 'AI note', meta: 'ai-only' };
    case 'spacer':
      return { title: 'Spacer', meta: item.size ?? 'md' };
    case 'divider':
      return { title: 'Divider', meta: undefined };
    default:
      return { title: '', meta: undefined };
  }
}

// ---------------------------------------------------------------------------
// Per-kind body components
// ---------------------------------------------------------------------------

function contentLocaleText(text: ContentItem['text'], loc: string, fallback: string): string {
  if (typeof text === 'string') return loc === fallback ? text : '';
  return text[loc] ?? '';
}

function setContentLocaleText(text: ContentItem['text'], loc: string, value: string, locales: string[]): ContentItem['text'] {
  const base: Record<string, string> = typeof text === 'string' ? { [locales[0] ?? 'en']: text } : { ...text };
  base[loc] = value;
  return base;
}

function ContentItemEditor({ item, onUpdate, locales = ['en'] }: { item: ContentItem; onUpdate: (patch: Partial<ContentItem>) => void; locales?: string[] }) {
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
              onChange={(e) => onUpdate({ text: setContentLocaleText(item.text, loc, e.target.value, locales) })}
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox aria-label="locked" checked={locked} onCheckedChange={(c) => onUpdate({ locked: c === true })} />
        locked (preset — not editable by the filler)
      </label>
    </div>
  );
}

function SpacerItemEditor({ item, onUpdate }: { item: SpacerItem; onUpdate: (patch: Partial<SpacerItem>) => void }) {
  return (
    <div className="border-t border-input p-3">
      <span className="flex flex-col gap-1 text-xs text-muted-foreground">
        Size
        <Select value={item.size ?? 'md'} onValueChange={(v) => onUpdate({ size: v as SpacerSize })}>
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

function AiNoteItemEditor({ item, onUpdate }: { item: AiNoteItem; onUpdate: (patch: Partial<AiNoteItem>) => void }) {
  return (
    <div className="border-t border-input p-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Note for AI (not shown to the filler)
        <Textarea aria-label="ai-note text" value={item.text} onChange={(e) => onUpdate({ text: e.target.value })} rows={3} />
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
// Public: ItemEditor — collapsible, kind-accented card
// ---------------------------------------------------------------------------

export interface ItemEditorProps {
  item: FormItem;
  siblingFields?: SiblingField[];
  locales?: string[];
  onUpdate: (patch: Partial<FormItem>) => void;
  onRemove: () => void;
  /** Optional drag handle (rendered at the start of the header) supplied by the arranger. */
  dragHandle?: React.ReactNode;
  /** Start expanded (default collapsed — the builder shows scannable summary rows). */
  defaultOpen?: boolean;
}

export function ItemEditor({ item, siblingFields = [], locales = ['en'], onUpdate, onRemove, dragHandle, defaultOpen = false }: ItemEditorProps) {
  const meta = KIND_META[item.kind];
  const Icon = meta.Icon;
  const { title, meta: sub } = itemSummary(item);
  const [open, setOpen] = React.useState(defaultOpen);

  const required = item.kind === 'field' && Boolean(item.required);
  const hasConditional = (item.kind === 'field' || item.kind === 'content' || item.kind === 'divider' || item.kind === 'spacer') && Boolean((item as { conditional?: unknown }).conditional);
  const locked = item.kind === 'content' && Boolean(item.locked);

  return (
    <div
      className="overflow-hidden rounded-md border border-input bg-card"
      style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}
      data-kind={item.kind}
    >
      <div className="flex items-center gap-2 p-2">
        {dragHandle}
        {/* Single disclosure control: chevron + kind icon + summary all toggle the card. */}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-muted-foreground hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={open ? 'collapse item' : 'expand item'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
            aria-hidden
          >
            <Icon className="size-3.5" />
          </span>
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          {sub ? <span className="truncate font-mono text-[11px] text-muted-foreground">{sub}</span> : null}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {required ? <Pill tone="danger">required</Pill> : null}
          {hasConditional ? <Pill tone="warn">when…</Pill> : null}
          {locked ? <Pill tone="accent">locked</Pill> : null}
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="remove item" onClick={onRemove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {open ? (
        <div>
          {item.kind === 'field' ? (
            <FieldItemEditor field={item as FieldItem} onUpdate={onUpdate as (patch: Partial<FieldItem>) => void} locales={locales} siblingFields={siblingFields} />
          ) : item.kind === 'content' ? (
            <ContentItemEditor item={item as ContentItem} onUpdate={onUpdate as (patch: Partial<ContentItem>) => void} locales={locales} />
          ) : item.kind === 'spacer' ? (
            <SpacerItemEditor item={item as SpacerItem} onUpdate={onUpdate as (patch: Partial<SpacerItem>) => void} />
          ) : item.kind === 'ai-note' ? (
            <AiNoteItemEditor item={item as AiNoteItem} onUpdate={onUpdate as (patch: Partial<AiNoteItem>) => void} />
          ) : item.kind === 'divider' ? (
            <DividerItemBody />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
