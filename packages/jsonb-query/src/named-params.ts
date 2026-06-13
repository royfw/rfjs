import type { BuildJsonbOptions, JsonbFilterGroup, JsonbQueryResult } from './types';
import { buildJsonbQuery } from './build';
import { JsonbQueryError } from './errors';

export interface NamedParamsResult {
  where: string;
  params: Record<string, unknown>;
}

export interface BuildNamedJsonbOptions extends BuildJsonbOptions {
  /** Named-parameter prefix (default `"p"`): `:p1`, `:p2`, … */
  prefix?: string;
}

const PREFIX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Convert a positional result (`$N` + values array) into named-parameter form
 * (`:pN` + params object) for query layers with named bindings (TypeORM
 * QueryBuilder, Knex). The core output stays positional — PostgreSQL's native
 * form — and this helper is opt-in.
 *
 * Placeholder numbering is detected from the SQL text, so results built with
 * `paramOffset` map correctly. Named form also keeps repeated placeholder
 * references (e.g. `startswith` reuses its value) pointing at a single param,
 * which naive positional-`?` conversion cannot express.
 */
/**
 * Internal: rewrite positional `$N` placeholders in `sql` to `:<prefix>N` and
 * build the matching params object. Shared by `toNamedParams` and the ORDER BY
 * named builder. Not part of the public API (not re-exported from the barrel).
 *
 * The lookbehind keeps `$` inside quoted identifiers (e.g. "t$1") from being
 * rewritten: real placeholders are never preceded by an identifier character or
 * a double quote. Values never appear in the SQL text, so no user data can be
 * affected by this rewrite.
 */
export function positionalToNamed(
  sql: string,
  values: unknown[],
  prefix: string,
): { sql: string; params: Record<string, unknown> } {
  if (!PREFIX.test(prefix)) {
    throw new JsonbQueryError(`Invalid named-parameter prefix: ${JSON.stringify(prefix)}`, 'INVALID_PREFIX');
  }
  const seen = new Set<number>();
  const rewritten = sql.replace(/(?<![A-Za-z0-9_$"])\$(\d+)/g, (_match, n: string) => {
    seen.add(Number(n));
    return `:${prefix}${n}`;
  });
  const numbers = [...seen].sort((a, b) => a - b);
  const offset = (numbers[0] ?? 1) - 1;
  const contiguous =
    numbers.length === values.length && numbers.every((n, i) => n === offset + i + 1);
  if (!contiguous) {
    throw new JsonbQueryError('placeholders do not match the values array', 'PARAM_MISMATCH');
  }
  return {
    sql: rewritten,
    params: Object.fromEntries(values.map((value, i) => [`${prefix}${offset + i + 1}`, value])),
  };
}

export function toNamedParams(result: JsonbQueryResult, prefix = 'p'): NamedParamsResult {
  const { sql, params } = positionalToNamed(result.where, result.values, prefix);
  return { where: sql, params };
}

/**
 * One-call variant for named-binding query layers (TypeORM QueryBuilder,
 * Knex): `buildJsonbQuery` + `toNamedParams`. `paramOffset` shifts the
 * parameter *names* (`:p5`, …), which also avoids key collisions when
 * composing several fragments into one query.
 */
export function buildNamedJsonbQuery(
  column: string,
  filter: JsonbFilterGroup,
  options: BuildNamedJsonbOptions = {},
): NamedParamsResult {
  const { prefix, ...buildOptions } = options;
  return toNamedParams(buildJsonbQuery(column, filter, buildOptions), prefix);
}
