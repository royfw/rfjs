'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@rfjs/web-ui/components/table';
import { Button } from '@rfjs/web-ui/components/button';
import { formatCell, getByPath, resolveLabel } from '@rfjs/table-builder';
import type { TableColumnConfig, TableConfig } from '@rfjs/table-builder';
import { useConfigTable } from './use-config-table';
import { DEFAULT_LABELS } from './labels';
import type { TableLabels, TableSource } from './types';

export interface ConfigTableProps {
  config: TableConfig;
  /**
   * Data source (design spec §5.1). Like `use-data-source`'s convention, callers MUST keep
   * `source` referentially stable across renders (e.g. memoize it, or construct it once outside
   * the render body) -- `useConfigTable`'s remote fetch effect depends on `source` identity, so a
   * fresh object literal on every render would refetch on every render.
   */
  source: TableSource;
  labels?: Partial<TableLabels>;
  /** BCP-47 locale used to resolve column labels and format cell values. Defaults to `'en'`. */
  locale?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// {page}/{count}/{total} placeholder replacement -- intentionally NOT an i18n library (design
// spec §5.3): labels are a flat English-default deck, not a full message catalog.
function replacePlaceholders(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.split(`{${key}}`).join(String(value)), template);
}

// Column order (spec §5.3): pin-left group (original order) -> unpinned -> pin-right group
// (original order). Hidden (`visible: false`) columns are dropped entirely.
function orderColumns(columns: TableColumnConfig[]): TableColumnConfig[] {
  const visible = columns.filter((c) => c.visible !== false);
  const left = visible.filter((c) => c.pin === 'left');
  const none = visible.filter((c) => c.pin !== 'left' && c.pin !== 'right');
  const right = visible.filter((c) => c.pin === 'right');
  return [...left, ...none, ...right];
}

function alignClass(column: TableColumnConfig): string {
  const align = column.align ?? (column.dataType === 'numeric' ? 'right' : 'left');
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
}

export function ConfigTable({ config, source, labels, locale = 'en' }: ConfigTableProps) {
  const t = useConfigTable(config, source);
  const mergedLabels: TableLabels = { ...DEFAULT_LABELS, ...labels };

  const orderedColumns = React.useMemo(() => orderColumns(config.columns), [config.columns]);
  const leftPinned = React.useMemo(() => orderedColumns.filter((c) => c.pin === 'left'), [orderedColumns]);
  const rightPinned = React.useMemo(() => orderedColumns.filter((c) => c.pin === 'right'), [orderedColumns]);

  // Multi-pin cumulative offsets (spec §5.3): the single-pin case never needs these -- the lone
  // pinned column just sits at the left-0/right-0 edge. When a group has 2+ pinned columns, the
  // non-edge ones are pushed further in by the measured width of the columns between them and
  // the edge. Measured via the container ref (the web-ui table primitives don't forward refs)
  // after layout; jsdom reports 0 widths, which is fine -- tests only assert class presence.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [leftOffsets, setLeftOffsets] = React.useState<number[]>([]);
  const [rightOffsets, setRightOffsets] = React.useState<number[]>([]);

  React.useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const headCells = root.querySelectorAll('thead th');

    if (leftPinned.length > 1) {
      const widths = leftPinned.map((c) => {
        const idx = orderedColumns.indexOf(c);
        return (headCells.item(idx) as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
      });
      const next: number[] = [];
      let acc = 0;
      for (const w of widths) {
        next.push(acc);
        acc += w;
      }
      setLeftOffsets(next);
    }

    if (rightPinned.length > 1) {
      const widths = rightPinned.map((c) => {
        const idx = orderedColumns.indexOf(c);
        return (headCells.item(idx) as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
      });
      const next = new Array<number>(widths.length).fill(0);
      let acc = 0;
      for (let i = widths.length - 1; i >= 0; i--) {
        next[i] = acc;
        acc += widths[i] ?? 0;
      }
      setRightOffsets(next);
    }
    // orderedColumns/leftPinned/rightPinned are derived from config.columns; t.rows changing
    // (page/sort) can change rendered content width, so it's included to re-measure.
  }, [orderedColumns, leftPinned, rightPinned, t.rows]);

  function pinProps(column: TableColumnConfig): { className: string; style?: React.CSSProperties } {
    if (column.pin === 'left') {
      const idx = leftPinned.indexOf(column);
      const isEdge = idx === 0;
      return {
        className: cx('sticky', 'z-10', 'bg-background', isEdge && 'left-0', 'shadow-[2px_0_6px_-2px_rgba(0,0,0,0.15)]'),
        style: isEdge ? undefined : { left: leftOffsets[idx] ?? 0 },
      };
    }
    if (column.pin === 'right') {
      const idx = rightPinned.indexOf(column);
      const isEdge = idx === rightPinned.length - 1;
      return {
        className: cx('sticky', 'z-10', 'bg-background', isEdge && 'right-0', 'shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.15)]'),
        style: isEdge ? undefined : { right: rightOffsets[idx] ?? 0 },
      };
    }
    return { className: '' };
  }

  const emptyText = config.emptyText !== undefined ? resolveLabel(config.emptyText, locale) : mergedLabels.empty;
  const pageSizeOptions = config.pagination.pageSizeOptions ?? [];
  const showPageOf = t.strategy !== 'cursor';

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            {orderedColumns.map((column) => {
              const pin = pinProps(column);
              const label = resolveLabel(column.label, locale);
              const active = t.sort?.key === column.key;
              return (
                <TableHead key={column.key} className={cx(alignClass(column), pin.className)} style={pin.style}>
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium"
                      onClick={() => t.toggleSort(column.key)}
                    >
                      <span>{label}</span>
                      {active &&
                        (t.sort!.direction === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        ))}
                    </button>
                  ) : (
                    label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {t.loading ? (
            <TableRow>
              <TableCell colSpan={orderedColumns.length} className="text-center text-muted-foreground">
                {mergedLabels.loading}
              </TableCell>
            </TableRow>
          ) : t.error ? (
            <TableRow>
              <TableCell colSpan={orderedColumns.length} className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-destructive">{mergedLabels.error}</span>
                  <Button size="xs" variant="outline" onClick={t.retry}>
                    {mergedLabels.retry}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : t.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={orderedColumns.length} className="text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            t.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {orderedColumns.map((column) => {
                  const pin = pinProps(column);
                  return (
                    <TableCell key={column.key} className={cx(alignClass(column), pin.className)} style={pin.style}>
                      {formatCell(getByPath(row, column.key), column, locale)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          {t.total !== undefined && <span>{replacePlaceholders(mergedLabels.total, { total: t.total })}</span>}
          {pageSizeOptions.length > 0 && (
            <label className="flex items-center gap-1.5">
              <span>{mergedLabels.pageSize}</span>
              <select
                className="h-7 rounded-md border border-input bg-transparent px-1.5 text-sm"
                value={t.pageSize}
                onChange={(e) => t.setPageSize(Number(e.target.value))}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showPageOf && <span>{replacePlaceholders(mergedLabels.pageOf, { page: t.page, count: t.pageCount ?? '' })}</span>}
          <Button size="xs" variant="outline" disabled={!t.canPrev} onClick={t.prevPage}>
            {mergedLabels.prev}
          </Button>
          <Button size="xs" variant="outline" disabled={!t.canNext} onClick={t.nextPage}>
            {mergedLabels.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
