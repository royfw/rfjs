/** Quote a SQL identifier. Identifiers come from ColumnConfig, never user input. */
export function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}
