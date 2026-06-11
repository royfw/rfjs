import { describe, it, expect } from 'vitest';
import { TextMatch } from './TextMatch';

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

    describe('TextMatch', () => {
        describe('isnotnull', () => {
            it('undefined key: false', () => {
                const query = new TextMatch(
                    'a2.string',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('null key: false', () => {
                const query = new TextMatch(
                    'a1.nullText',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string: true', () => {
                const query = new TextMatch(
                    'a1.string',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('isnull', () => {
            it('undefined key: true', () => {
                const query = new TextMatch(
                    'a2.number',
                    'isnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('nullText: true', () => {
                const query = new TextMatch(
                    'a1.nullText',
                    'isnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('endswith', () => {
            it('undefined key: false', () => {
                const query = new TextMatch(
                    'a2.number',
                    'endswith',
                    ['la', 'jour'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new TextMatch(
                    'a1.nullText',
                    'endswith',
                    ['la', 'jour'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 2ture: true', () => {
                const query = new TextMatch(
                    'a1.textArray',
                    'endswith',
                    ['la', 'jour'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('textArray item 2 - 2false: false', () => {
                const query = new TextMatch(
                    'a1.textArray',
                    'endswith',
                    ['he', 'ho'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 1true 1false: true', () => {
                const query = new TextMatch(
                    'a1.textArray',
                    'endswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2 - 1true 1false: true', () => {
                const query = new TextMatch(
                    'a1.text',
                    'endswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2: true', () => {
                const query = new TextMatch(
                    'a1.text',
                    'endswith',
                    ['hola', 'a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 1: false', () => {
                const query = new TextMatch(
                    'a1.text',
                    'endswith',
                    ['ho'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('text item 1: true', () => {
                const query = new TextMatch(
                    'a1.text',
                    'endswith',
                    ['la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('startswith', () => {
            it('undefined key: false', () => {
                const query = new TextMatch(
                    'a2.number',
                    'startswith',
                    ['hel', 'bon'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new TextMatch(
                    'a1.nullText',
                    'startswith',
                    ['hel', 'bon'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 2ture: true', () => {
                const query = new TextMatch(
                    'a1.textArray',
                    'startswith',
                    ['hel', 'bon'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('textArray item 2 - 2false: false', () => {
                const query = new TextMatch(
                    'a1.textArray',
                    'startswith',
                    ['lo', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 1true 1false: true', () => {
                const query = new TextMatch(
                    'a1.textArray',
                    'startswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2 - 1true 1false: true', () => {
                const query = new TextMatch(
                    'a1.text',
                    'startswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2: true', () => {
                const query = new TextMatch(
                    'a1.text',
                    'startswith',
                    ['hola', 'h'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 1: false', () => {
                const query = new TextMatch(
                    'a1.text',
                    'startswith',
                    ['la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('text item 1: true', () => {
                const query = new TextMatch(
                    'a1.text',
                    'startswith',
                    ['ho'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
        });

        describe('contains', () => {
            it('undefined key: false', () => {
                const query = new TextMatch(
                    'a2.number',
                    'contains',
                    ['Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new TextMatch(
                    'a1.nullText',
                    'contains',
                    ['Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 item: false', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'contains',
                    ['Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 item: true', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'contains',
                    ['C'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string: true', () => {
                const query = new TextMatch(
                    'a1.contains',
                    'contains',
                    ['con'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string: false', () => {
                const query = new TextMatch(
                    'a1.contains',
                    'contains',
                    ['cn'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });

        describe('terms', () => {
            it('undefined key: false', () => {
                const query = new TextMatch(
                    'a2.number',
                    'terms',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new TextMatch(
                    'a1.nullText',
                    'terms',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 0 match: false', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'terms',
                    'X',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 match: true', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'terms',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('stringArray 2 items - 2false: false', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'terms',
                    ['W', 'Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 2 items - 1 true, 1false: true', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'terms',
                    ['C1', 'Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 2 items - 1true, 1false: true', () => {
                const query = new TextMatch(
                    'a1.string',
                    'terms',
                    ['b', 'z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 1: true', () => {
                const query = new TextMatch(
                    'a1.string',
                    'terms',
                    ['b'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 2: true', () => {
                const query = new TextMatch(
                    'string',
                    'terms',
                    ['a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 1: false', () => {
                const query = new TextMatch(
                    'a1.string',
                    'terms',
                    ['a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 2 items: false', () => {
                const query = new TextMatch(
                    'a1.string',
                    'terms',
                    ['a', 'z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });

        describe('eq', () => {
            it('undefined key: false', () => {
                const query = new TextMatch(
                    'a2.number',
                    'eq',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new TextMatch(
                    'a1.nullText',
                    'eq',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 0 match: false', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'eq',
                    'Z',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 match: false', () => {
                const query = new TextMatch(
                    'a1.stringArray',
                    'eq',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 2 items - 2false: false', () => {
                const query = new TextMatch(
                    'a1.string',
                    'eq',
                    ['z', 'c'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 2 items - 1true, 1false: false', () => {
                const query = new TextMatch(
                    'a1.string',
                    'eq',
                    ['b', 'c'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 1: true', () => {
                const query = new TextMatch(
                    'a1.string',
                    'eq',
                    ['b'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 2: true', () => {
                const query = new TextMatch(
                    'string',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 1: false', () => {
                const query = new TextMatch(
                    'a1.string',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });
        });

        describe('valid path', () => {
            it('error path', () => {
                const query = new TextMatch(
                    'a2.string',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.validPath).toEqual(false);
            });

            it('valid path', () => {
                const query = new TextMatch(
                    'a1.string',
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
            expect(new TextMatch('name', 'neq', 'Bob', { name: 'Alice' }).isMatch).toBe(true);
        });
        it('scalar: no match when the value equals', () => {
            expect(new TextMatch('name', 'neq', 'Alice', { name: 'Alice' }).isMatch).toBe(false);
        });
        it('array: no match when the value is present', () => {
            expect(new TextMatch('tags', 'neq', 'B', { tags: ['A', 'B'] }).isMatch).toBe(false);
        });
        it('array: matches when the value is absent', () => {
            expect(new TextMatch('tags', 'neq', 'Z', { tags: ['A', 'B'] }).isMatch).toBe(true);
        });
    });

    describe('operator validation', () => {
        it('throws on a type-mismatched operator', () => {
            expect(
                () => new TextMatch('a', 'gt' as never, '1', { a: '1' }),
            ).toThrow(/unsupported operator/);
        });
        it('throws on a prototype method name used as operator', () => {
            expect(
                () => new TextMatch('a', 'toString' as never, '1', { a: '1' }),
            ).toThrow(/unsupported operator/);
        });
    });

    describe('TextMatch regex-safe prefix/suffix matching', () => {
        it('startswith treats a regex metacharacter literally', () => {
            // value "a." must match a literal "a." prefix, not "a" + any char
            expect(
                new TextMatch('s', 'startswith', 'a.', { s: 'a.bc' }).isMatch,
            ).toBe(true);
            expect(
                new TextMatch('s', 'startswith', 'a.', { s: 'aXbc' }).isMatch,
            ).toBe(false);
        });

        it('endswith treats a regex metacharacter literally', () => {
            expect(
                new TextMatch('s', 'endswith', '.c', { s: 'ab.c' }).isMatch,
            ).toBe(true);
            expect(
                new TextMatch('s', 'endswith', '.c', { s: 'abXc' }).isMatch,
            ).toBe(false);
        });

        it('does not throw on a value that is an invalid regex', () => {
            expect(
                () => new TextMatch('s', 'startswith', '(', { s: 'test' }).isMatch,
            ).not.toThrow();
            expect(
                () => new TextMatch('s', 'endswith', '(', { s: 'test' }).isMatch,
            ).not.toThrow();
        });
    });
});
