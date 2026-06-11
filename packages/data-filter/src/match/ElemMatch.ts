import { resolvePath } from '../path/resolve';
import type { FilterMatchQuery } from '../types';

/** Evaluator injected by `createMatchQuery` (the `matchQuery` function) to avoid an import cycle. */
export type ElemMatchEvaluator = (data: object, filters: FilterMatchQuery) => boolean;

export class ElemMatch {
  isMatch = false;
  constructor(
    field: string,
    filters: FilterMatchQuery,
    data: object,
    evaluate: ElemMatchEvaluator,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw = resolvePath(data, field);
    const elements = Array.isArray(raw) ? (raw as unknown[]) : [];
    this.isMatch = elements.some(
      (element) => typeof element === 'object' && element !== null && evaluate(element, filters),
    );
  }
}
