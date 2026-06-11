import { describe, it, expect } from 'vitest';
import { NumericMatch } from './NumericMatch';

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
        },
    };

    describe('NumericMatch', () => {
        describe('range', () => {
            it('numberArray 1 match: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'range',
                    [60, 120],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('numberArray all unmatch: false', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'range',
                    [5, 10],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('numberArray all match: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'range',
                    [50, 1000],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'range',
                    [50, 120],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number 2: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'range',
                    [100, 120],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number: false', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'range',
                    [110, 120],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });

        describe('lt', () => {
            it('numberArray 2 items - 2false: false', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'lt',
                    [15, 19],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('numberArray 2 items - 1true 1false: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'lt',
                    [1500, 10],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('numberArray 2 items - 2true: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'lt',
                    [500, 120],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('numberArray 1match: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'lt',
                    500,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('numberArray all unmatch: false', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'lt',
                    15,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('numberArray all match: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'lt',
                    5000,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number 2 items - 2true: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'lt',
                    [5000, 1500],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number 2 items - 2false: false', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'lt',
                    [25, 15],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('number 2 items - 1true 1false: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'lt',
                    [50, 150],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'lt',
                    500,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number: false', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'lt',
                    15,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });

        describe('gt', () => {
            it('numberArray 2 items - 2false: false', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'gt',
                    [1500, 1900],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('numberArray 2 items - 1true 1false: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'gt',
                    [1500, 100],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('numberArray 2 items - 2true: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'gt',
                    [500, 100],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('numberArray 1match: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'gt',
                    500,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('numberArray all unmatch: false', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'gt',
                    1500,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('numberArray all match: true', () => {
                const query = new NumericMatch(
                    'a1.numberArray',
                    'gt',
                    50,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number 2 items - 2true: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'gt',
                    [50, 15],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number 2 items - 2false: false', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'gt',
                    [250, 150],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('number 2 items - 1true 1false: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'gt',
                    [50, 150],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'gt',
                    50,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number: false', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'gt',
                    150,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });

        describe('isnotnull', () => {
            it('undefined key: false', () => {
                const query = new NumericMatch(
                    'a2.number',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('null key: false', () => {
                const query = new NumericMatch(
                    'a1.nullText',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('number: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('isnull', () => {
            it('nullText: true', () => {
                const query = new NumericMatch(
                    'a1.nullText',
                    'isnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('eq', () => {
            it('number 1: true', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'eq',
                    100,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number 2: true', () => {
                const query = new NumericMatch(
                    'number',
                    'eq',
                    [1000],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('number 1: false', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'eq',
                    999,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });
        describe('path', () => {
            it('error path', () => {
                const query = new NumericMatch(
                    'a2.number',
                    'eq',
                    null,
                    testData1,
                );
                expect(query.validPath).toEqual(false);
            });

            it('valid path', () => {
                const query = new NumericMatch(
                    'a1.number',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.validPath).toEqual(true);
            });
        });
    });

    describe('neq (value-absent semantics)', () => {
        it('scalar: matches when the value differs', () => {
            expect(new NumericMatch('n', 'neq', 5, { n: 3 }).isMatch).toBe(true);
        });
        it('scalar: no match when the value equals', () => {
            expect(new NumericMatch('n', 'neq', 3, { n: 3 }).isMatch).toBe(false);
        });
        it('array: no match when the value is present', () => {
            expect(new NumericMatch('a', 'neq', 2, { a: [1, 2, 3] }).isMatch).toBe(false);
        });
        it('array: matches when the value is absent', () => {
            expect(new NumericMatch('a', 'neq', 9, { a: [1, 2, 3] }).isMatch).toBe(true);
        });
        it('does not silently pass an unparseable (NaN) filter value', () => {
            expect(new NumericMatch('n', 'neq', 'garbage' as never, { n: 5 }).isMatch).toBe(false);
        });
    });

    describe('range arity', () => {
        it('throws when range does not receive exactly 2 values', () => {
            expect(() => new NumericMatch('n', 'range', 5, { n: 10 })).toThrow(
                /exactly 2 values/,
            );
            expect(() => new NumericMatch('n', 'range', [1, 2, 3], { n: 10 })).toThrow(
                /exactly 2 values/,
            );
        });
        it('accepts reversed bounds via min/max', () => {
            expect(new NumericMatch('n', 'range', [120, 50], { n: 100 }).isMatch).toBe(true);
        });
    });

    describe('operator validation', () => {
        it('throws on a type-mismatched operator', () => {
            expect(
                () => new NumericMatch('a', 'contains' as never, 1, { a: 1 }),
            ).toThrow(/unsupported operator/);
        });
        it('throws on a prototype method name used as operator', () => {
            expect(
                () => new NumericMatch('a', 'toString' as never, 1, { a: 1 }),
            ).toThrow(/unsupported operator/);
        });
    });
});
