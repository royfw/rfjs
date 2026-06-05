/**
 * Quote a PostgreSQL identifier (table / schema / database / column name) so it
 * is safe to interpolate into a SQL statement.
 *
 * Identifiers cannot be parameterised with `$1` placeholders, so they must be
 * escaped by hand: wrap in double quotes and double any embedded double quote.
 * A null byte cannot appear in an identifier and is rejected outright.
 *
 * @example
 * `CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`
 */
export function quoteIdent(identifier: string): string {
  if (identifier.includes('\0')) {
    throw new Error(`Invalid identifier: contains a null byte`);
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}
