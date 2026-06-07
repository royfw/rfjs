import type { BuildJsonbOptions, JsonbFilterGroup, JsonbQueryResult } from './types';
import { buildJsonbQuery } from './build';

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
export function toNamedParams(result: JsonbQueryResult, prefix = 'p'): NamedParamsResult {
  if (!PREFIX.test(prefix)) {
    throw new Error(`Invalid named-parameter prefix: ${JSON.stringify(prefix)}`);
  }

  // The lookbehind keeps `$` inside quoted identifiers (e.g. "t$1") from being
  // rewritten: real placeholders are never preceded by an identifier
  // character or a double quote. Values never appear in the SQL text, so no
  // user data can be affected by this rewrite.
  const seen = new Set<number>();
  const where = result.where.replace(/(?<![A-Za-z0-9_$"])\$(\d+)/g, (_match, n: string) => {
    seen.add(Number(n));
    return `:${prefix}${n}`;
  });

  const numbers = [...seen].sort((a, b) => a - b);
  const offset = (numbers[0] ?? 1) - 1;
  const contiguous =
    numbers.length === result.values.length &&
    numbers.every((n, i) => n === offset + i + 1);
  if (!contiguous) {
    throw new Error('toNamedParams: placeholders do not match the values array');
  }

  return {
    where,
    params: Object.fromEntries(
      result.values.map((value, i) => [`${prefix}${offset + i + 1}`, value]),
    ),
  };
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
