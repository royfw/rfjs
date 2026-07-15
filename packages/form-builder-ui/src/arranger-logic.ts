import type { FormConfig } from '@rfjs/form-builder';
import {
  normalizeToSections,
  moveItemWithinRow,
  moveItemToRow,
  splitToNewRow,
} from '@rfjs/form-builder';

/**
 * Pure function: maps a @dnd-kit drag-end (active id, over id) to the
 * appropriate engine tree-op and returns the updated config.
 *
 * Drop-zone id encoding:
 *   - item id          → reorder within row, or cross-row move
 *   - `row:<rowId>`    → append to that row
 *   - `newrow:<sectionId>:<index>` → split to new row at index (post-removal)
 *
 * When active === over or overId is empty, returns config unchanged.
 */
export function resolveDragEnd(
  config: FormConfig,
  activeId: string,
  overId: string,
): FormConfig {
  if (!overId || activeId === overId) return config;

  const sections = normalizeToSections(config);

  // Locate the active item and its current row/section
  let activeRowId: string | undefined;
  let activeSectionId: string | undefined;
  let sourceRowItemCount = 0;
  let sourceRowIndexInSection = -1;

  for (const section of sections) {
    for (let ri = 0; ri < section.rows.length; ri++) {
      const row = section.rows[ri]!;
      if (row.items.some((item) => item.id === activeId)) {
        activeRowId = row.id;
        activeSectionId = section.id;
        sourceRowItemCount = row.items.length;
        sourceRowIndexInSection = ri;
        break;
      }
    }
    if (activeRowId) break;
  }

  if (!activeRowId) return config; // active item not found

  // ---------------------------------------------------------------------------
  // Case 1: over is `newrow:<sectionId>:<index>`
  // ---------------------------------------------------------------------------
  if (overId.startsWith('newrow:')) {
    const rest = overId.slice('newrow:'.length);
    const lastColon = rest.lastIndexOf(':');
    const sectionId = rest.slice(0, lastColon);
    const dropIndex = parseInt(rest.slice(lastColon + 1), 10);

    // CRITICAL: adjust for post-removal index shift.
    // When the active item is the only item in its source row, that row will be
    // removed by splitToNewRow. If the source row is in the SAME target section
    // and precedes the drop index, the removal shifts all later rows down by 1.
    let targetIndex = dropIndex;
    const srcRowBecomesEmpty = sourceRowItemCount === 1;
    const sameSection = activeSectionId === sectionId;
    if (srcRowBecomesEmpty && sameSection && sourceRowIndexInSection < dropIndex) {
      targetIndex = dropIndex - 1;
    }

    return splitToNewRow(config, activeId, sectionId, targetIndex);
  }

  // ---------------------------------------------------------------------------
  // Case 2: over is `row:<rowId>`
  // ---------------------------------------------------------------------------
  if (overId.startsWith('row:')) {
    const targetRowId = overId.slice('row:'.length);
    if (targetRowId === activeRowId) return config; // same row, no-op
    return moveItemToRow(config, activeId, targetRowId);
  }

  // ---------------------------------------------------------------------------
  // Case 3: over is another item id
  // ---------------------------------------------------------------------------
  // Find the target item's row
  let overRowId: string | undefined;
  let overItemIndex = -1;
  let activeItemIndex = -1;

  for (const section of sections) {
    for (const row of section.rows) {
      const overIdx = row.items.findIndex((item) => item.id === overId);
      if (overIdx !== -1) {
        overRowId = row.id;
        overItemIndex = overIdx;
        // Also find active index in case same row
        activeItemIndex = row.items.findIndex((item) => item.id === activeId);
        break;
      }
    }
    if (overRowId) break;
  }

  if (!overRowId) return config;

  if (overRowId === activeRowId) {
    // Same row — reorder
    if (activeItemIndex === -1) return config;
    return moveItemWithinRow(config, activeRowId, activeItemIndex, overItemIndex);
  }

  // Different row — move to that row at the over-item's position
  return moveItemToRow(config, activeId, overRowId, overItemIndex);
}
