'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { resolveLabel, type LocalizedLabel } from '@rfjs/form-builder';
import { deriveTableConfig, type TableConfig } from '@rfjs/table-builder';
import { inferFieldsFromRows } from '@rfjs/data-schema';
import { ConfigTable } from '@rfjs/table-builder-ui';

export type ResultViewState = 'empty' | 'loading' | 'error' | 'ready';

export interface ResultViewProps {
  mode: 'card' | 'json' | 'table';
  state: ResultViewState;
  value?: unknown;
  maxItems?: number;
  table?: TableConfig;
  emptyText?: LocalizedLabel;
  locale?: string;
}

const isScalar = (v: unknown): v is string | number | boolean =>
  v === null || ['string', 'number', 'boolean'].includes(typeof v);

function KvCard({ value }: { value: unknown }) {
  if (isScalar(value)) {
    return <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">{String(value)}</div>;
  }
  const entries = Object.entries((value ?? {}) as Record<string, unknown>);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-input bg-muted/30 px-3 py-2.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-3 text-sm">
          <span className="w-24 shrink-0 pt-px font-mono text-xs text-muted-foreground">{k}</span>
          {isScalar(v) ? (
            <span className="min-w-0 break-words">{String(v)}</span>
          ) : (
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{JSON.stringify(v)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

const stateBox = 'flex min-h-24 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/20 text-sm text-muted-foreground';

function ResultTable({ rows, table, locale }: { rows: Record<string, unknown>[]; table?: TableConfig; locale: string }) {
  const config = React.useMemo(
    () => table ?? deriveTableConfig({ fields: inferFieldsFromRows(rows) }),
    [table, rows],
  );
  const source = React.useMemo(() => ({ kind: 'rows' as const, rows }), [rows]);
  return <ConfigTable config={config} source={source} locale={locale} />;
}

/** api 回應的純展示元件 —— card 刻意零配置(僅 maxItems);欄位級控制屬 table 模式(table-builder)。 */
export function ResultView({ mode, state, value, maxItems, table, emptyText, locale = 'en' }: ResultViewProps) {
  if (state === 'empty') {
    return <div className={stateBox}>{emptyText ? resolveLabel(emptyText, locale) : 'No result yet'}</div>;
  }
  if (state === 'loading') {
    return (
      <div className={stateBox}>
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (state === 'error') {
    return <div className={`${stateBox} border-destructive/40 text-destructive`}>Request failed</div>;
  }

  if (mode === 'json') {
    return (
      <pre className="max-h-64 overflow-auto rounded-md border border-input bg-muted/30 p-3 font-mono text-xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (mode === 'table') {
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : null;
    if (!rows || rows.length === 0 || !rows.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) {
      return <div className={stateBox}>{emptyText ? resolveLabel(emptyText, locale) : 'No result yet'}</div>;
    }
    return <ResultTable rows={rows} table={table} locale={locale} />;
  }

  // mode === 'card'
  if (Array.isArray(value)) {
    const cap = maxItems ?? 10;
    const shown = value.slice(0, cap);
    const rest = value.length - shown.length;
    return (
      <div className="flex flex-col gap-2">
        {shown.map((row, i) => (
          <KvCard key={i} value={row} />
        ))}
        {rest > 0 && (
          <div className="rounded-md border border-dashed border-input py-1.5 text-center text-xs text-muted-foreground">{`+ ${rest} more`}</div>
        )}
      </div>
    );
  }
  return <KvCard value={value} />;
}
