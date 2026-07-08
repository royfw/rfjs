import { describe, expect, it } from 'vitest';
import { hasNextCursor, offsetToPage, pageCount, pageToOffset } from './paginate';

describe('pageCount', () => {
  it('returns 1 when total is 0', () => {
    expect(pageCount(0, 10)).toBe(1);
  });

  it('rounds up to the next page', () => {
    expect(pageCount(101, 10)).toBe(11);
  });

  it('returns exactly the number of full pages when total divides evenly', () => {
    expect(pageCount(100, 10)).toBe(10);
  });
});

describe('pageToOffset / offsetToPage', () => {
  it('converts page to offset with default firstPage = 1', () => {
    expect(pageToOffset(1, 10)).toBe(0);
    expect(pageToOffset(2, 10)).toBe(10);
    expect(pageToOffset(3, 10)).toBe(20);
  });

  it('converts page to offset with firstPage = 0', () => {
    expect(pageToOffset(0, 10, 0)).toBe(0);
    expect(pageToOffset(1, 10, 0)).toBe(10);
  });

  it('converts offset to page with default firstPage = 1', () => {
    expect(offsetToPage(0, 10)).toBe(1);
    expect(offsetToPage(10, 10)).toBe(2);
    expect(offsetToPage(25, 10)).toBe(3);
  });

  it('converts offset to page with firstPage = 0', () => {
    expect(offsetToPage(0, 10, 0)).toBe(0);
    expect(offsetToPage(10, 10, 0)).toBe(1);
  });

  it('round-trips page -> offset -> page', () => {
    expect(offsetToPage(pageToOffset(5, 25), 25)).toBe(5);
    expect(offsetToPage(pageToOffset(5, 25, 0), 25, 0)).toBe(5);
  });
});

describe('hasNextCursor', () => {
  it('returns false when cursor is undefined', () => {
    expect(hasNextCursor(undefined)).toBe(false);
  });

  it('returns true when cursor has a value', () => {
    expect(hasNextCursor('abc123')).toBe(true);
  });
});
