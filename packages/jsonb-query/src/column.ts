const SEGMENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export function quoteJsonbColumn(column: string): string {
  return column
    .split('.')
    .map((segment) => {
      if (!SEGMENT.test(segment)) {
        throw new Error(`Invalid JSONB column: ${JSON.stringify(column)}`);
      }
      return `"${segment}"`;
    })
    .join('.');
}
