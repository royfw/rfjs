// Total number of pages for a given total row count and page size; always at least 1.
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Converts a 1-indexed (or firstPage-indexed) page number to a 0-indexed row offset.
export function pageToOffset(page: number, pageSize: number, firstPage: 0 | 1 = 1): number {
  return (page - firstPage) * pageSize;
}

// Converts a 0-indexed row offset back to a page number, indexed from `firstPage`.
export function offsetToPage(offset: number, pageSize: number, firstPage: 0 | 1 = 1): number {
  return Math.floor(offset / pageSize) + firstPage;
}

// Cursor-mode "has next page" check: any non-empty cursor value means there is a next page.
export function hasNextCursor(cursor: string | undefined): boolean {
  return cursor !== undefined && cursor !== '';
}
