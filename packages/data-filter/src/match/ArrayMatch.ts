import { resolvePath } from '../path/resolve';
import { typeTransfer } from '../filter/matchQuery';
import { assertOperator, ARRAY_OPERATORS_BY_ELEMENT } from './operators';
import { TextMatch } from './TextMatch';
import { NumericMatch } from './NumericMatch';
import { DateMatch } from './DateMatch';
import type { MatchQueryDataType, ObjectData } from '../types';

function toTimestamp(value: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const d = typeTransfer(value, 'date');
  return d instanceof Date ? d.getTime() : Number(d);
}

/** Strict, transform-aware per-element equality (∃ uses this for eq/containsall). */
function eqElement(el: unknown, value: unknown, elementType: MatchQueryDataType): boolean {
  if (elementType === 'date') {
    const a = toTimestamp(el);
    return !Number.isNaN(a) && a === toTimestamp(value);
  }
  const transferType = elementType === 'numeric' ? 'number' : elementType; // 'string' | 'boolean'
  return typeTransfer(el, transferType) === typeTransfer(value, transferType);
}

/** Reuse a scalar matcher over the resolved elements for the ∃ comparison ops. */
function scalarElementMatch(
  elementType: MatchQueryDataType,
  operator: string,
  value: unknown,
  elements: unknown[],
): { isMatch: boolean } {
  const data = { __el__: elements } as unknown as ObjectData;
  switch (elementType) {
    case 'string':
      return new TextMatch('__el__', operator as never, value as never, data);
    case 'numeric':
      return new NumericMatch('__el__', operator as never, value as never, data);
    case 'date':
      return new DateMatch('__el__', operator as never, value as never, data);
    default:
      return { isMatch: false }; // boolean has no comparison ops (only eq, handled earlier)
  }
}

export class ArrayMatch {
  isMatch = false;
  constructor(
    field: string,
    elementType: MatchQueryDataType,
    operator: string,
    value: unknown,
    data: object,
  ) {
    assertOperator(`array<${elementType}>`, operator, ARRAY_OPERATORS_BY_ELEMENT[elementType]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw = resolvePath(data, field);
    if (operator === 'isnull') {
      this.isMatch = raw === null || raw === undefined;
      return;
    }
    if (operator === 'isnotnull') {
      this.isMatch = raw !== null && raw !== undefined;
      return;
    }
    if (!Array.isArray(raw)) {
      this.isMatch = false; // non-array → empty → no match
      return;
    }
    const elements = raw as unknown[];
    if (operator === 'eq') {
      this.isMatch = elements.some((el) => eqElement(el, value, elementType));
      return;
    }
    if (operator === 'containsall') {
      const wanted = Array.isArray(value) ? value : [value];
      this.isMatch = wanted.every((w) => elements.some((el) => eqElement(el, w, elementType)));
      return;
    }
    this.isMatch = scalarElementMatch(elementType, operator, value, elements).isMatch;
  }
}
