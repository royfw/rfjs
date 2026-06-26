'use client';

import * as React from 'react';
import type { FormConfig, FormItem, ItemKind } from '@rfjs/form-builder';
import { parseFormConfig, normalizeToSections, makeItem } from '@rfjs/form-builder';
import { Button } from '@rfjs/web-ui/components/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@rfjs/web-ui/components/select';

import { useConfigBuilder } from './use-config-builder';
import { ConfigForm } from './config-form';
import { SectionArranger } from './section-arranger';

// ---------------------------------------------------------------------------
// Item-kind palette — the new v2 palette adds items by kind.
// "field" is a special kind (adds a new FieldItem); the rest are non-field items.
// ---------------------------------------------------------------------------

const KIND_PALETTE: { kind: ItemKind; label: string }[] = [
  { kind: 'field', label: '+ Field' },
  { kind: 'content', label: '+ Content' },
  { kind: 'divider', label: '+ Divider' },
  { kind: 'spacer', label: '+ Spacer' },
  { kind: 'ai-note', label: '+ AI Note' },
];

const EMPTY: FormConfig = { version: 1, fields: [] };

// Module-level counter for the cold-start (no-rows) branch of addKindItem, so a
// fresh row gets a deterministic, collision-free id even if that path fires more
// than once (e.g. user clears all items then adds again). No Math.random per repo rule.
let initRowSeq = 0;

export interface ConfigFormBuilderProps {
  initialConfig?: FormConfig;
  onChange?: (config: FormConfig) => void;
  locale?: string;
  locales?: string[];
}

export function ConfigFormBuilder({ initialConfig = EMPTY, onChange, locale = 'en', locales = ['en'] }: ConfigFormBuilderProps) {
  const builder = useConfigBuilder(initialConfig, onChange);

  // The form is "empty" only when no items exist at all (covers both v1 fields[] and v2 sections[]).
  const hasItems = normalizeToSections(builder.config).some((s) => s.rows.some((r) => r.items.length > 0));
  const [tab, setTab] = React.useState<'builder' | 'json'>('builder');
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  /**
   * Add a new item of the given kind into the config.
   * Canonicalizes to sections, then appends into the last row of the first section.
   * If the section has no rows (or doesn't exist yet), builds a new row inline via replace.
   */
  function addKindItem(kind: ItemKind) {
    const item: FormItem = makeItem(kind);
    const sections = normalizeToSections(builder.config);
    const section = sections[0];
    const lastRow = section?.rows[section.rows.length - 1];

    if (section && lastRow) {
      // Happy path: append to the last row of the first section
      builder.addItem(section.id, lastRow.id, item);
    } else {
      // No section yet (v1 empty) or section has no rows — build a minimal sections config.
      // useConfigBuilder.replace fires onChange synchronously, which is what we want.
      // Use a module-level counter for the row id so repeated cold-starts never collide.
      const newRow = { id: `row_init_${(initRowSeq += 1)}`, items: [item] };
      const existingSections = sections.length > 0 ? sections : [{ id: `section_init_${initRowSeq}`, rows: [] }];
      const newSections = existingSections.map((s, i) =>
        i === 0 ? { ...s, rows: [...s.rows, newRow] } : s,
      );
      builder.replace({ version: builder.config.version, sections: newSections });
    }
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
            {KIND_PALETTE.map(({ kind, label }) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                size="sm"
                aria-label={label}
                onClick={() => addKindItem(kind)}
              >
                {label}
              </Button>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              Columns
              <Select
                value={String(
                  normalizeToSections(builder.config)[0]?.columns ??
                  builder.config.columns ??
                  1,
                )}
                onValueChange={(v) => {
                  const sections = normalizeToSections(builder.config);
                  const s0 = sections[0];
                  if (s0) {
                    builder.setSectionColumns(s0.id, Number(v) as 1 | 2 | 3 | 4);
                  } else {
                    builder.setColumns(Number(v) as FormConfig['columns']);
                  }
                }}
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

          <div className="rounded-lg border bg-card p-4">
            {!hasItems ? (
              <p
                data-testid="empty-state-hint"
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No fields yet — add one from the palette above
              </p>
            ) : (
              <SectionArranger
                config={builder.config}
                builder={builder}
                locales={locales}
              />
            )}
          </div>

          <div data-testid="config-form-preview" className="rounded-lg border bg-card p-4">
            {!hasItems ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Preview will appear here once you add fields</p>
            ) : (
              <ConfigForm
                config={builder.config}
                locale={locale}
                onSubmit={() => {}}
              />
            )}
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
