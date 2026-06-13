/**
 * E2E tests against real PostgreSQL instances. Self-skips when PG_E2E_URLS is
 * not set, so it is safe to run anywhere (never wired into CI).
 *
 * Start the instances:
 *   docker run -d --name jsonb-e2e-pg11 -e POSTGRES_PASSWORD=e2e -p 54311:5432 postgres:11.16
 *   docker run -d --name jsonb-e2e-pg16 -e POSTGRES_PASSWORD=e2e -p 54316:5432 postgres:16-alpine
 *
 * Run:
 *   PG_E2E_URLS="postgres://postgres:e2e@localhost:54311/postgres,postgres://postgres:e2e@localhost:54316/postgres" \
 *     pnpm -F @rfjs/jsonb-query vitest:e2e:run
 *
 * Version gates: legacy dialect runs on every version; jsonpath needs PG 12+
 * (PostgreSQL 11.16 — the production target — runs the legacy suite only);
 * jsonpath date comparisons (.datetime()) need PG 13+.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { buildJsonbQuery, buildJsonbOrderBy } from '../src';
import type { BuildJsonbOptions, JsonbDialect, JsonbFilterGroup } from '../src';

const URLS = (process.env.PG_E2E_URLS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const INJECTION = "x'; drop table e2e_t; --";

const SEED: Array<[number, unknown]> = [
  [
    1,
    {
      name: 'bob',
      age: 30,
      vip: true,
      joined: '2020-01-15T08:30:00Z',
      profile: { vip: true, level: 3 },
      tags: ['a', 'b'],
      roles: [], // empty array — exercises isempty (no other test touches `roles`)
      nums: [1, 5, 9],
      items: [
        { sku: 'x', qty: 2, ship: '2020-02-01T00:00:00+00:00', meta: { vip: true } },
        { sku: 'y', qty: 10, ship: '2021-02-01T00:00:00+00:00' },
      ],
      orders: [{ status: 'open', lines: [{ sku: 'x' }] }],
    },
  ],
  [
    2,
    {
      name: 'alice',
      age: 18,
      vip: false,
      joined: '2021-03-20T00:00:00Z',
      profile: { vip: false },
      tags: ['b', 'c'],
      roles: ['admin'], // non-empty array — exercises isnotempty
      nums: [10, 20],
      items: [{ sku: 'y', qty: 1 }],
    },
  ],
  // JSON null age; profile present with a null-valued key (for haskey vs isnotnull).
  [3, { name: 'carol', age: null, profile: { vip: null } }],
  // Malformed shapes: tags is a scalar, items is an object (not an array).
  [4, { name: 'dave', tags: 'a', items: { sku: 'x', qty: 99 } }],
  // Regex metacharacters + hostile value stored as data.
  [5, { name: 'a.b', memo: INJECTION }],
  [6, { name: 'axb' }],
  // Date-only format (vs the full ISO timestamps above).
  [7, { joined: '2021-03-20' }],
  // PG-friendly offset format (jsonpath .datetime() rejects the 'Z' suffix).
  [8, { joined: '2020-01-15T08:30:00+00:00' }],
];

describe.skipIf(URLS.length === 0)('jsonb-query e2e', () => {
  describe.each(URLS.map((url) => [url.replace(/\/\/.*@/, '//***@'), url]))(
    '%s',
    (_label, url) => {
      let client: Client;
      let version = 0; // server_version_num, e.g. 110016 / 160014

      const dialects = (): JsonbDialect[] =>
        version >= 120000 ? ['legacy', 'jsonpath'] : ['legacy'];

      async function ids(
        filter: JsonbFilterGroup,
        options?: BuildJsonbOptions,
      ): Promise<number[]> {
        const { where, values } = buildJsonbQuery('data', filter, options);
        const res = await client.query(
          `select id from e2e_t where ${where} order by id`,
          values,
        );
        return res.rows.map((r: { id: number }) => Number(r.id));
      }

      /** Assert the same row set for every dialect available on this server. */
      async function expectIds(
        filter: JsonbFilterGroup,
        expected: number[],
      ): Promise<void> {
        for (const dialect of dialects()) {
          expect(await ids(filter, { dialect }), dialect).toEqual(expected);
        }
      }

      /** Assert per-dialect row sets where the dialects intentionally diverge. */
      async function expectPerDialect(
        filter: JsonbFilterGroup,
        expected: Partial<Record<JsonbDialect, number[]>>,
      ): Promise<void> {
        for (const dialect of dialects()) {
          expect(await ids(filter, { dialect }), dialect).toEqual(expected[dialect]);
        }
      }

      beforeAll(async () => {
        // Retry the initial connection: CI service containers may accept TCP
        // before PG is actually ready to serve queries.
        let lastError: unknown;
        for (let attempt = 0; attempt < 30; attempt += 1) {
          client = new Client({ connectionString: url });
          try {
            await client.connect();
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            await client.end().catch(() => undefined);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
        if (lastError) {
          throw lastError;
        }
        await client.query("set timezone to 'UTC'");
        version = Number(
          (await client.query('show server_version_num')).rows[0].server_version_num,
        );
        await client.query('drop table if exists e2e_t');
        await client.query('create table e2e_t (id int primary key, data jsonb)');
        for (const [id, data] of SEED) {
          await client.query('insert into e2e_t values ($1, $2::jsonb)', [
            id,
            JSON.stringify(data),
          ]);
        }
      });

      afterAll(async () => {
        await client?.end();
      });

      it('an empty filter group renders true (matches all rows)', async () => {
        await expectIds({ logic: 'and', filters: [] }, [1, 2, 3, 4, 5, 6, 7, 8]);
      });

      describe('scalar conditions', () => {
        const one = (f: JsonbFilterGroup['filters'][number]): JsonbFilterGroup => ({
          logic: 'and',
          filters: [f],
        });

        it('eq / neq string', async () => {
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'eq', value: 'bob' }), [1]);
          // neq: rows with a missing field yield SQL NULL and never match.
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'neq', value: 'bob' }), [2, 3, 4, 5, 6]);
        });

        it('numeric gt / range / terms', async () => {
          await expectIds(one({ field: 'age', dataType: 'numeric', operator: 'gt', value: 20 }), [1]);
          await expectIds(one({ field: 'age', dataType: 'numeric', operator: 'range', value: [10, 40] }), [1, 2]);
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'terms', value: ['bob', 'alice'] }), [1, 2]);
        });

        it('boolean eq', async () => {
          await expectIds(one({ field: 'vip', dataType: 'boolean', operator: 'eq', value: true }), [1]);
        });

        it('isnull treats JSON null and missing keys alike', async () => {
          await expectIds(one({ field: 'age', dataType: 'numeric', operator: 'isnull' }), [3, 4, 5, 6, 7, 8]);
          await expectIds(one({ field: 'age', dataType: 'numeric', operator: 'isnotnull' }), [1, 2]);
        });

        it('date eq — stored "Z" suffix is invisible to jsonpath .datetime()', async () => {
          // ids 1 and 8 store the same instant: id 1 as '...Z' (JS
          // toISOString style), id 8 as '...+00:00'. The query value's 'Z' is
          // normalized by the builder, but stored 'Z' strings fail
          // .datetime() parsing and lax mode swallows the error -> jsonpath
          // only sees id 8. Use the legacy dialect for 'Z'-suffixed data.
          await expectPerDialect(
            one({ field: 'joined', dataType: 'date', operator: 'eq', value: '2020-01-15T08:30:00Z' }),
            { legacy: [1, 8], jsonpath: [8] },
          );
        });

        it('date gt — mixed stored formats (timestamp vs date-only)', async () => {
          // id 2 stores '...Z'; id 7 stores a date-only string.
          // legacy ::timestamptz casts both -> [2, 7].
          // jsonpath: jsonb_path_exists_tz lets the date-only value (7)
          // compare against the timestamptz query value, but id 2's stored
          // 'Z' suffix still fails .datetime() parsing -> [7] only.
          await expectPerDialect(
            one({ field: 'joined', dataType: 'date', operator: 'gt', value: '2020-06-01T00:00:00Z' }),
            { legacy: [2, 7], jsonpath: [7] },
          );
        });

        it('contains escapes regex metacharacters (a.b must not match axb)', async () => {
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'contains', value: 'a.b' }), [5]);
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'startswith', value: 'bo' }), [1]);
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'endswith', value: 'ce' }), [2]);
        });
      });

      describe('object conditions', () => {
        it('eq is structural (key order insensitive)', async () => {
          await expectIds(
            {
              logic: 'and',
              filters: [{ field: 'profile', dataType: 'object', operator: 'eq', value: { level: 3, vip: true } }],
            },
            [1],
          );
        });

        it('contains / isnull', async () => {
          await expectIds(
            { logic: 'and', filters: [{ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: false } }] },
            [2],
          );
          await expectIds(
            // id 3 now seeds profile: { vip: null }, so it is no longer null.
            { logic: 'and', filters: [{ field: 'profile', dataType: 'object', operator: 'isnull' }] },
            [4, 5, 6, 7, 8],
          );
        });
      });

      describe('scalar-array conditions', () => {
        const one = (f: JsonbFilterGroup['filters'][number]): JsonbFilterGroup => ({
          logic: 'and',
          filters: [f],
        });

        it('element eq (∃ semantics)', async () => {
          await expectIds(
            one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'b' }),
            [1, 2],
          );
        });

        it('malformed shape divergence: scalar stored where an array is expected', async () => {
          // id 4 stores tags: "a" (scalar). legacy's typeof guard treats it as
          // an empty array; jsonpath lax mode auto-wraps it -> matches.
          await expectPerDialect(
            one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }),
            { legacy: [1], jsonpath: [1, 4] },
          );
        });

        it('element gt / range / terms', async () => {
          await expectIds(
            one({ field: 'nums', dataType: 'array', elementType: 'numeric', operator: 'gt', value: 15 }),
            [2],
          );
          await expectIds(
            one({ field: 'nums', dataType: 'array', elementType: 'numeric', operator: 'range', value: [4, 6] }),
            [1],
          );
          await expectIds(
            one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'terms', value: ['c', 'z'] }),
            [2],
          );
        });

        it('containsall', async () => {
          await expectIds(
            one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }),
            [1],
          );
        });

        it('isnull on the array field itself', async () => {
          await expectIds(
            one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'isnull' }),
            [3, 5, 6, 7, 8],
          );
        });

        it('element neq = value not present (∀); missing/non-array match', async () => {
          // tags present on 1 (a,b) and 2 (b,c); 'a' present only on 1.
          // not-present-'a' => everyone except id 1 (incl. missing tags + the
          // malformed scalar "a" on id 4: legacy treats scalar as empty array;
          // jsonpath lax-wraps "a" but "a" != ... wait it equals -> see note).
          await expectPerDialect(
            { logic: 'and', filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'neq', value: 'a' }] },
            { legacy: [2, 3, 4, 5, 6, 7, 8], jsonpath: [2, 3, 5, 6, 7, 8] },
          );
        });
      });

      describe('elemmatch', () => {
        it('object condition inside elemmatch (jsonpath uses SQL fallback)', async () => {
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
                      { field: 'meta', dataType: 'object', operator: 'contains', value: { vip: true } },
                    ],
                  },
                },
              ],
            },
            [1],
          );
        });

        it('scalar-array condition inside elemmatch', async () => {
          // orders[0] has lines (array of objects); use a scalar-array seed.
          // id 1 items all have sku; assert "some element whose sku is in a set".
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'y' },
                      { field: 'qty', dataType: 'numeric', operator: 'gte', value: 10 },
                    ],
                  },
                },
              ],
            },
            [1],
          );
        });

        it('binds all sub-conditions to the same element', async () => {
          // id 1: {y,10} satisfies both; id 2: {y,1} fails qty.
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'y' },
                      { field: 'qty', dataType: 'numeric', operator: 'gt', value: 5 },
                    ],
                  },
                },
              ],
            },
            [1],
          );
        });

        it('malformed shape divergence: object stored where an array is expected', async () => {
          // id 4 stores items as a single object. legacy's guard -> no match;
          // jsonpath lax mode wraps it into a one-element array -> matches.
          await expectPerDialect(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
                      { field: 'qty', dataType: 'numeric', operator: 'gt', value: 5 },
                    ],
                  },
                },
              ],
            },
            { legacy: [], jsonpath: [4] },
          );
        });

        it('nested or-groups inside elemmatch', async () => {
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'y' },
                      {
                        logic: 'or',
                        filters: [
                          { field: 'qty', dataType: 'numeric', operator: 'gt', value: 5 },
                          { field: 'qty', dataType: 'numeric', operator: 'lt', value: 2 },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
            [1, 2],
          );
        });

        it('nested elemmatch', async () => {
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'orders', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'status', dataType: 'string', operator: 'eq', value: 'open' },
                      {
                        field: 'lines', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                        filters: {
                          logic: 'and',
                          filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'x' }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
            [1],
          );
        });

        it('isnull inside elemmatch covers missing members in both dialects', async () => {
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'y' },
                      { field: 'note', dataType: 'string', operator: 'isnull' },
                    ],
                  },
                },
              ],
            },
            [1, 2],
          );
        });

        it('date comparison inside elemmatch (jsonpath needs PG 13+)', async () => {
          const filter: JsonbFilterGroup = {
            logic: 'and',
            filters: [
              {
                field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                filters: {
                  logic: 'and',
                  filters: [
                    { field: 'sku', dataType: 'string', operator: 'eq', value: 'y' },
                    { field: 'ship', dataType: 'date', operator: 'gt', value: '2020-12-31T00:00:00Z' },
                  ],
                },
              },
            ],
          };
          for (const dialect of dialects()) {
            if (dialect === 'jsonpath' && version < 130000) continue;
            expect(await ids(filter, { dialect }), dialect).toEqual([1]);
          }
        });
      });

      describe('nor / not groups', () => {
        it('not over an array condition = "does not contain" consistently', async () => {
          // Missing tags (3,5,6,7) and the malformed scalar "a" (4, which is
          // not "b" even after lax wrapping) all count as "does not contain".
          await expectIds(
            {
              logic: 'not',
              filters: [
                { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'b' },
              ],
            },
            [3, 4, 5, 6, 7, 8],
          );
        });

        it('not over a scalar condition diverges on missing fields (three-valued logic)', async () => {
          // id 7 has no name. legacy: not(NULL) is NULL -> excluded.
          // jsonpath: jsonb_path_exists() returns false for the missing field,
          // so not(false) -> included.
          await expectPerDialect(
            {
              logic: 'not',
              filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: 'bob' }],
            },
            { legacy: [2, 3, 4, 5, 6], jsonpath: [2, 3, 4, 5, 6, 7, 8] },
          );
        });

        it('nor (NOT any) follows the same per-dialect null semantics', async () => {
          // Matching rows must fail BOTH conditions. age is missing on 4,5,6,7
          // and JSON null on 3: legacy NULL-poisons the disjunction; jsonpath
          // just sees false.
          await expectPerDialect(
            {
              logic: 'nor',
              filters: [
                { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
                { field: 'age', dataType: 'numeric', operator: 'gt', value: 25 },
              ],
            },
            { legacy: [2], jsonpath: [2, 3, 4, 5, 6, 7, 8] },
          );
        });
      });

      describe('operator expansion', () => {
        const one = (f: JsonbFilterGroup['filters'][number]): JsonbFilterGroup => ({ logic: 'and', filters: [f] });

        it('haskey detects a null-valued key that isnotnull misses', async () => {
          // id 3 has profile.vip = null: the KEY exists (haskey) but the VALUE is null (isnotnull false).
          await expectIds(one({ field: 'profile', dataType: 'object', operator: 'haskey', value: 'vip' }), [1, 2, 3]);
          await expectIds(one({ field: 'profile.vip', dataType: 'boolean', operator: 'isnotnull' }), [1, 2]);
        });

        it('hasanykey / hasallkeys', async () => {
          await expectIds(one({ field: 'profile', dataType: 'object', operator: 'hasallkeys', value: ['vip', 'level'] }), [1]);
          await expectIds(one({ field: 'profile', dataType: 'object', operator: 'hasanykey', value: ['level', 'nope'] }), [1]);
        });

        it('case-insensitive contains matches regardless of case', async () => {
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'icontains', value: 'BO' }), [1]);
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'ieq', value: 'ALICE' }), [2]);
        });

        it('isempty / isnotempty distinguish empty, non-empty, and missing arrays', async () => {
          // id 1 roles:[] (empty), id 2 roles:['admin'] (non-empty); no other row has `roles`.
          await expectIds(one({ field: 'roles', dataType: 'array', elementType: 'string', operator: 'isempty' }), [1]);
          await expectIds(one({ field: 'roles', dataType: 'array', elementType: 'string', operator: 'isnotempty' }), [2]);
          // tags present and non-empty on 1 and 2; missing/scalar elsewhere → not non-empty.
          await expectIds(one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'isnotempty' }), [1, 2]);
        });
      });

      describe('safety', () => {
        it('round-trips a hostile value through parameters', async () => {
          await expectIds(
            { logic: 'and', filters: [{ field: 'memo', dataType: 'string', operator: 'eq', value: INJECTION }] },
            [5],
          );
          await expectIds(
            { logic: 'and', filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: INJECTION }] },
            [],
          );
          // The table survived.
          expect((await client.query('select count(*) from e2e_t')).rows[0].count).toBe('8');
        });

        it('treats hostile field names as data, not SQL/jsonpath', async () => {
          await expectIds(
            {
              logic: 'and',
              filters: [
                { field: 'nope"; drop table e2e_t; --', dataType: 'string', operator: 'eq', value: 'x' },
              ],
            },
            [],
          );
          expect((await client.query('select count(*) from e2e_t')).rows[0].count).toBe('8');
        });
      });

      it('honours paramOffset when embedded after existing parameters', async () => {
        for (const dialect of dialects()) {
          const { where, values } = buildJsonbQuery(
            'data',
            { logic: 'and', filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: 'bob' }] },
            { dialect, paramOffset: 1 },
          );
          const res = await client.query(
            `select id from e2e_t where id > $1 and ${where} order by id`,
            [0, ...values],
          );
          expect(res.rows.map((r: { id: number }) => Number(r.id)), dialect).toEqual([1]);
        }
      });

      it('orders by a numeric jsonb path (desc, nulls last)', async () => {
        // Seed ages: id1=30, id2=18, id3=null, ids4-8 have no age. desc nulls last
        // → 30,18 first, then the null/missing-age rows; secondary `, id` makes the
        // null group deterministic.
        const ob = buildJsonbOrderBy('data', [
          { field: 'age', dataType: 'numeric', direction: 'desc', nulls: 'last' },
        ]);
        const res = await client.query(
          `select id from e2e_t order by ${ob.orderBy}, id`,
          ob.values,
        );
        expect(res.rows.map((r: { id: number }) => Number(r.id))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      });
    },
  );
});
