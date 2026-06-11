import { describe, it, expect } from 'vitest';
import { BooleanMatch } from './BooleanMatch';

describe('arrayQuery', () => {
    const testData1 = {
        string: 'a',
        number: 1000,
        a1: {
            string: 'b',
            nullText: null,
            text: 'hola',
            textArray: ['hola', 'hello', 'bonjour'],
            contains: 'contains',
            stringArray: ['A', 'B', 'C1', 'D2', 'E3'],
            number: 100,
            numberArray: [100, 999, 50],
            boolean: true,
            false: false,
            booleanArray: [true, false, true, false, false],
        },
    };

    describe('BooleanMatch', () => {
        describe('isnotnull', () => {
            it('undefined key: false', () => {
                const query = new BooleanMatch(
                    'a2.number',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('null key: false', () => {
                const query = new BooleanMatch(
                    'a1.nullText',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('number: true', () => {
                const query = new BooleanMatch(
                    'a1.number',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('isnull', () => {
            it('boolean undefined: true', () => {
                const query = new BooleanMatch(
                    'a1.boolean2',
                    'isnull',
                    true,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('nullText: true', () => {
                const query = new BooleanMatch(
                    'a1.nullText',
                    'isnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('neq', () => {
            it('boolean undefined: true', () => {
                const query = new BooleanMatch(
                    'a1.boolean2',
                    'neq',
                    true,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('boolean null: true', () => {
                const query = new BooleanMatch(
                    'a1.nullText',
                    'neq',
                    true,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('booleanArray neq false: false (value present)', () => {
                // booleanArray = [true, false, true, false, false] contains
                // false, so "not equal to false" (value-absent) is false.
                const query = new BooleanMatch(
                    'a1.booleanArray',
                    'neq',
                    false,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('booleanArray neq false: true (value absent)', () => {
                const query = new BooleanMatch(
                    'a1.allTrue',
                    'neq',
                    false,
                    { a1: { allTrue: [true, true] } },
                );
                expect(query.isMatch).toEqual(true);
            });

            it('boolean bool: true', () => {
                const query = new BooleanMatch(
                    'a1.boolean',
                    'neq',
                    false,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('boolean bool: false', () => {
                const query = new BooleanMatch(
                    'a1.boolean',
                    'neq',
                    true,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });
        describe('eq', () => {
            it('boolean undefined: false', () => {
                const query = new BooleanMatch(
                    'a1.boolean2',
                    'eq',
                    true,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('boolean null: false', () => {
                const query = new BooleanMatch(
                    'a1.nullText',
                    'eq',
                    true,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('boolean bool: true', () => {
                const query = new BooleanMatch(
                    'a1.boolean',
                    'eq',
                    true,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('boolean stringbool: true', () => {
                const query = new BooleanMatch(
                    'a1.boolean',
                    'eq',
                    'true',
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('boolean boolean: false', () => {
                const query = new BooleanMatch(
                    'a1.boolean',
                    'eq',
                    false,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });

        describe('path', () => {
            it('error path', () => {
                const query = new BooleanMatch(
                    'a2.number',
                    'eq',
                    null,
                    testData1,
                );
                expect(query.validPath).toEqual(false);
            });

            it('valid path', () => {
                const query = new BooleanMatch(
                    'a1.number',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.validPath).toEqual(true);
            });
        });
    });

        describe('operator validation', () => {
            it('throws on a type-mismatched operator', () => {
                expect(
                    () => new BooleanMatch('a1.boolean', 'range' as never, true, testData1),
                ).toThrow(/unsupported operator/);
            });
            it('throws on a prototype method name used as operator', () => {
                expect(
                    () => new BooleanMatch('a1.boolean', 'toString' as never, true, testData1),
                ).toThrow(/unsupported operator/);
            });
        });
});
