import type {
  FormConfig,
  FormItem,
  FormRow,
  FormSection,
  FieldItem,
  ItemKind,
} from './types';
import { normalizeToSections } from './normalize';

// Module counter for deterministic IDs — no Math.random (per repo rule).
let idc = 0;
const nextId = (prefix: string) => `${prefix}_${(idc += 1)}`;

/**
 * Create a fresh FormItem of the given kind. `makeItem` owns `id` and `kind`:
 * the `seed` type excludes them, and any `id`/`kind` slipped in via a cast is
 * defensively stripped so a caller can never override the generated identity.
 * For 'field', the remaining seed merges over sensible defaults.
 */
export function makeItem(kind: ItemKind, seed?: Omit<Partial<FieldItem>, 'id' | 'kind'>): FormItem {
  const id = nextId(kind);
  // Defensively strip id/kind in case a caller cast past the param type.
  const { id: _omitId, kind: _omitKind, ...rest } = (seed ?? {}) as Partial<FieldItem>;
  void _omitId;
  void _omitKind;
  switch (kind) {
    case 'field': {
      const n = idc; // reuse current counter value for key uniqueness
      const key = rest.key ?? `field_${n}`;
      return {
        kind: 'field',
        id,
        key,
        label: 'Field',
        component: 'Input',
        dataType: 'string',
        ...rest,
      } as FieldItem;
    }
    case 'content':
      return { id, kind: 'content', text: '' };
    case 'divider':
      return { id, kind: 'divider' };
    case 'spacer':
      return { id, kind: 'spacer' };
    case 'ai-note':
      return { id, kind: 'ai-note', text: '' };
    case 'button':
      return { id, kind: 'button', label: 'Button', action: { type: 'custom', name: 'action-1' } };
  }
}

// Return type helper: sections-shaped FormConfig (no fields/columns)
function sectionsConfig(config: FormConfig, sections: FormSection[]): FormConfig {
  return { version: config.version, sections };
}

/** Add an item to a specific section's row, at optional index (appends if omitted). */
export function addItem(
  config: FormConfig,
  sectionId: string,
  rowId: string,
  item: FormItem,
  index?: number,
): FormConfig {
  const sections = normalizeToSections(config).map((section) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      rows: section.rows.map((row) => {
        if (row.id !== rowId) return row;
        const items = [...row.items];
        const at = index === undefined ? items.length : Math.max(0, Math.min(index, items.length));
        items.splice(at, 0, item);
        return { ...row, items };
      }),
    };
  });
  return sectionsConfig(config, sections);
}

/** Remove an item by id; also removes the row if it becomes empty. */
export function removeItem(config: FormConfig, itemId: string): FormConfig {
  const sections = normalizeToSections(config).map((section) => ({
    ...section,
    rows: section.rows
      .map((row) => ({ ...row, items: row.items.filter((item) => item.id !== itemId) }))
      .filter((row) => row.items.length > 0),
  }));
  return sectionsConfig(config, sections);
}

/** Patch an item by id (shallow merge). */
export function updateItem(
  config: FormConfig,
  itemId: string,
  patch: Partial<FormItem>,
): FormConfig {
  const sections = normalizeToSections(config).map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({
      ...row,
      items: row.items.map((item) =>
        item.id === itemId ? ({ ...item, ...patch } as FormItem) : item,
      ),
    })),
  }));
  return sectionsConfig(config, sections);
}

/** Reorder items within a row by moving from index `from` to index `to`. */
export function moveItemWithinRow(
  config: FormConfig,
  rowId: string,
  from: number,
  to: number,
): FormConfig {
  const sections = normalizeToSections(config).map((section) => ({
    ...section,
    rows: section.rows.map((row) => {
      if (row.id !== rowId) return row;
      const items = [...row.items];
      if (from < 0 || from >= items.length) return row;
      const clampedTo = Math.max(0, Math.min(to, items.length - 1));
      if (from === clampedTo) return row; // true no-op — avoid re-allocation
      const [moved] = items.splice(from, 1);
      items.splice(clampedTo, 0, moved);
      return { ...row, items };
    }),
  }));
  return sectionsConfig(config, sections);
}

/** Move an item to a different row; drops the source row if it becomes empty. */
export function moveItemToRow(
  config: FormConfig,
  itemId: string,
  targetRowId: string,
  index?: number,
): FormConfig {
  const rawSections = normalizeToSections(config);

  // Find and extract the item
  let movedItem: FormItem | undefined;
  const afterRemove = rawSections.map((section) => ({
    ...section,
    rows: section.rows
      .map((row) => {
        const found = row.items.find((i) => i.id === itemId);
        if (found) movedItem = found;
        return { ...row, items: row.items.filter((i) => i.id !== itemId) };
      })
      .filter((row) => row.items.length > 0),
  }));

  if (!movedItem) return sectionsConfig(config, rawSections);

  const item = movedItem;
  const sections = afterRemove.map((section) => ({
    ...section,
    rows: section.rows.map((row) => {
      if (row.id !== targetRowId) return row;
      const items = [...row.items];
      const at = index === undefined ? items.length : Math.max(0, Math.min(index, items.length));
      items.splice(at, 0, item);
      return { ...row, items };
    }),
  }));

  return sectionsConfig(config, sections);
}

/**
 * Split an item into a brand-new row at `index` within the given section.
 *
 * IMPORTANT: `index` is the insertion position in the section's row array
 * AFTER the (possibly-empty) source row has been removed — not against the
 * original row list. When the source row precedes the target position and
 * becomes empty as a result of the move, it is dropped first, shifting every
 * later index down by one. A caller computing `index` against the original
 * row list must adjust for that case.
 */
export function splitToNewRow(
  config: FormConfig,
  itemId: string,
  sectionId: string,
  index?: number,
): FormConfig {
  const rawSections = normalizeToSections(config);

  // Extract the item from its current row
  let movedItem: FormItem | undefined;
  const afterRemove = rawSections.map((section) => ({
    ...section,
    rows: section.rows
      .map((row) => {
        const found = row.items.find((i) => i.id === itemId);
        if (found) movedItem = found;
        return { ...row, items: row.items.filter((i) => i.id !== itemId) };
      })
      .filter((row) => row.items.length > 0),
  }));

  if (!movedItem) return sectionsConfig(config, rawSections);

  const item = movedItem;
  const newRow: FormRow = { id: nextId('row'), items: [item] };

  const sections = afterRemove.map((section) => {
    if (section.id !== sectionId) return section;
    const rows = [...section.rows];
    const at = index === undefined ? rows.length : Math.max(0, Math.min(index, rows.length));
    rows.splice(at, 0, newRow);
    return { ...section, rows };
  });

  return sectionsConfig(config, sections);
}

/** Add a new empty row to a section at optional index. */
export function addRow(config: FormConfig, sectionId: string, index?: number): FormConfig {
  const newRow: FormRow = { id: nextId('row'), items: [] };
  const sections = normalizeToSections(config).map((section) => {
    if (section.id !== sectionId) return section;
    const rows = [...section.rows];
    const at = index === undefined ? rows.length : Math.max(0, Math.min(index, rows.length));
    rows.splice(at, 0, newRow);
    return { ...section, rows };
  });
  return sectionsConfig(config, sections);
}

/** Add a new empty section at optional index. */
export function addSection(config: FormConfig, index?: number): FormConfig {
  const newSection: FormSection = { id: nextId('section'), rows: [] };
  const sections = [...normalizeToSections(config)];
  const at = index === undefined ? sections.length : Math.max(0, Math.min(index, sections.length));
  sections.splice(at, 0, newSection);
  return sectionsConfig(config, sections);
}

/** Set the columns property on a section. */
export function setSectionColumns(
  config: FormConfig,
  sectionId: string,
  columns: 1 | 2 | 3 | 4,
): FormConfig {
  const sections = normalizeToSections(config).map((section) =>
    section.id === sectionId ? { ...section, columns } : section,
  );
  return sectionsConfig(config, sections);
}
