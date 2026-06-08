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

        describe('萬用字元查詢支援', () => {
            it('應支援 users[*].age 萬用字元查詢', () => {
                const data = {
                    users: [
                        { userId: 1, age: 30, tags: ["A", "B"] },
                        { userId: 2, age: 25, tags: ["Z1", "Z2"] }
                    ]
                };
                const query = new NumericMatch('users[*].age', 'terms', 30, data);
                // 應該找到至少一個匹配 30 的
                expect(query.isMatch).toBe(true);
            });

            it('應支援 users[1].age 特定索引查詢', () => {
                const data = {
                    users: [
                        { userId: 1, age: 30 },
                        { userId: 2, age: 25 }
                    ]
                };
                const query = new NumericMatch('users[1].age', 'eq', 25, data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援 users[*].userId 萬用字元數值查詢', () => {
                const data = {
                    users: [
                        { userId: 1, age: 30 },
                        { userId: 2, age: 25 }
                    ]
                };
                const query = new NumericMatch('users[*].userId', 'terms', [1, 2], data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援深層巢狀路徑 data.users[*].profile.score', () => {
                const data = {
                    data: {
                        users: [
                            { userId: 1, profile: { score: 85 } },
                            { userId: 2, profile: { score: 90 } }
                        ]
                    }
                };
                const query = new NumericMatch('data.users[*].profile.score', 'gt', 80, data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援混合路徑 products[0].prices[*]', () => {
                const data = {
                    products: [
                        {
                            name: 'Product1',
                            prices: [100, 200, 300]
                        },
                        {
                            name: 'Product2',
                            prices: [150, 250]
                        }
                    ]
                };
                const query = new NumericMatch('products[0].prices[*]', 'range', [150, 250], data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援多層萬用字元 departments[*].employees[*].salary', () => {
                const data = {
                    departments: [
                        {
                            name: 'IT',
                            employees: [
                                { name: 'Alice', salary: 60000 },
                                { name: 'Bob', salary: 75000 }
                            ]
                        },
                        {
                            name: 'HR',
                            employees: [
                                { name: 'Charlie', salary: 55000 }
                            ]
                        }
                    ]
                };
                const query = new NumericMatch('departments[*].employees[*].salary', 'gt', 70000, data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援數值陣列比較 users[*].scores[*]', () => {
                const data = {
                    users: [
                        { userId: 1, scores: [85, 90, 95] },
                        { userId: 2, scores: [70, 75, 80] }
                    ]
                };
                const query = new NumericMatch('users[*].scores[*]', 'terms', 95, data);
                expect(query.isMatch).toBe(true);
            });

            it('應處理空陣列路徑 emptyArray[*].value', () => {
                const data = {
                    emptyArray: []
                };
                const query = new NumericMatch('emptyArray[*].value', 'eq', 100, data);
                expect(query.isMatch).toBe(false);
            });

            it('應支援特定索引後的萬用字元 orders[2].items[*].quantity', () => {
                const data = {
                    orders: [
                        { id: 1, items: [{ quantity: 1 }] },
                        { id: 2, items: [{ quantity: 2 }] },
                        { id: 3, items: [{ quantity: 3 }, { quantity: 5 }] }
                    ]
                };
                const query = new NumericMatch('orders[2].items[*].quantity', 'gt', 4, data);
                expect(query.isMatch).toBe(true);
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
    });

    describe('JSONPath 進階查詢測試', () => {
        it('應支援陣列切片查詢 users[0:2].age', () => {
            const data = {
                users: [
                    { age: 30 },
                    { age: 25 },
                    { age: 35 },
                    { age: 28 }
                ]
            };
            const query = new NumericMatch('users[0:2].age', 'terms', 30, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援負數索引查詢 users[-1:].age', () => {
            const data = {
                users: [
                    { age: 30 },
                    { age: 25 },
                    { age: 35 }
                ]
            };
            const query = new NumericMatch('users[-1:].age', 'eq', 35, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援負數範圍查詢 users[-2:].age', () => {
            const data = {
                users: [
                    { age: 30 },
                    { age: 25 },
                    { age: 35 }
                ]
            };
            const query = new NumericMatch('users[-2:].age', 'terms', 25, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援多個索引聯合查詢 users[0,2].age', () => {
            const data = {
                users: [
                    { age: 30 },
                    { age: 25 },
                    { age: 35 },
                    { age: 28 }
                ]
            };
            const query = new NumericMatch('users[0,2].age', 'terms', [30, 35], data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援過濾表達式 users[?(@.age>25)].age', () => {
            const data = {
                users: [
                    { name: 'Alice', age: 30 },
                    { name: 'Bob', age: 20 },
                    { name: 'Charlie', age: 28 }
                ]
            };
            const query = new NumericMatch('users[?(@.age>25)].age', 'terms', 30, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援過濾表達式 - 數值範圍 users[?(@.age>25)].age', () => {
            const data = {
                users: [
                    { name: 'Alice', age: 30 },
                    { name: 'Bob', age: 20 },
                    { name: 'Charlie', age: 28 }
                ]
            };
            const query = new NumericMatch('users[?(@.age>25)].age', 'range', [25, 30], data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援遞迴搜尋 $..age', () => {
            const data = {
                departments: [
                    { users: [{ age: 30 }, { age: 25 }] },
                    { users: [{ age: 35 }] }
                ]
            };
            const query = new NumericMatch('$..age', 'terms', 30, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援遞迴搜尋數值比較 $..score', () => {
            const data = {
                departments: [
                    { users: [{ score: 85 }, { score: 90 }] },
                    { users: [{ score: 95 }] }
                ]
            };
            const query = new NumericMatch('$..score', 'gt', 88, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援複合萬用字元 departments[*].users[*].salary', () => {
            const data = {
                departments: [
                    { users: [{ name: 'Alice', salary: 60000 }, { name: 'Bob', salary: 75000 }] },
                    { users: [{ name: 'Charlie', salary: 55000 }] }
                ]
            };
            const query = new NumericMatch('departments[*].users[*].salary', 'gt', 70000, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援步進切片 users[0:4:2].age', () => {
            const data = {
                users: [
                    { age: 25 },
                    { age: 30 },
                    { age: 35 },
                    { age: 40 }
                ]
            };
            const query = new NumericMatch('users[0:4:2].age', 'terms', [25, 35], data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援根路徑查詢 $.users[0].age', () => {
            const data = {
                users: [
                    { name: 'Alice', age: 30 },
                    { name: 'Bob', age: 25 }
                ]
            };
            const query = new NumericMatch('$.users[0].age', 'eq', 30, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援陣列長度查詢 $.users.length', () => {
            const data = {
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' },
                    { name: 'Charlie' }
                ]
            };
            const query = new NumericMatch('$.users.length', 'eq', 3, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援最後一筆查詢 users[(@.length-1)].score', () => {
            const data = {
                users: [
                    { score: 85 },
                    { score: 90 },
                    { score: 95 }
                ]
            };
            const query = new NumericMatch('users[(@.length-1)].score', 'eq', 95, data);
            expect(query.isMatch).toBe(true);
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
