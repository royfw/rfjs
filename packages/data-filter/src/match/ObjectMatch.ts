import { resolvePath } from '../path/resolve';
import { assertOperator, OBJECT_OPERATORS } from './operators';
import { contains, deepEqual } from './objectCompare';

export class ObjectMatch {
  isMatch = false;
  constructor(
    field: string,
    operator: string,
    value: Record<string, unknown> | undefined,
    data: object,
  ) {
    assertOperator('object', operator, OBJECT_OPERATORS);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const target = resolvePath(data, field);
    const expected = value ?? {};
    switch (operator) {
      case 'isnull':
        this.isMatch = target === null || target === undefined;
        break;
      case 'isnotnull':
        this.isMatch = target !== null && target !== undefined;
        break;
      case 'eq':
        this.isMatch = deepEqual(target, expected);
        break;
      case 'neq':
        this.isMatch = !deepEqual(target, expected);
        break;
      case 'contains':
        this.isMatch = contains(target, expected);
        break;
    }
  }
}
