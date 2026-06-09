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

    describe('萬用字元查詢支援', () => {
        it('應支援 users[*].active 萬用字元查詢', () => {
            const data = {
                users: [
                    { userId: 1, active: true, tags: ["A", "B"] },
                    { userId: 2, active: false, tags: ["Z1", "Z2"] }
                ]
            };
            const query = new BooleanMatch('users[*].active', 'eq', true, data);
            // 應該匹配第一個使用者的 active: true
            expect(query.isMatch).toBe(false); // 因為不是所有都是 true
        });

        it('應支援 users[0].active 特定索引查詢', () => {
            const data = {
                users: [
                    { userId: 1, active: true },
                    { userId: 2, active: false }
                ]
            };
            const query = new BooleanMatch('users[0].active', 'eq', true, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援 users[1].active 第二個索引查詢', () => {
            const data = {
                users: [
                    { userId: 1, active: true },
                    { userId: 2, active: false }
                ]
            };
            const query = new BooleanMatch('users[1].active', 'eq', false, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援深層巢狀路徑 data.users[*].profile.verified', () => {
            const data = {
                data: {
                    users: [
                        { userId: 1, profile: { verified: true } },
                        { userId: 2, profile: { verified: true } }
                    ]
                }
            };
            const query = new BooleanMatch('data.users[*].profile.verified', 'eq', true, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援混合路徑 organizations[0].members[*].isAdmin', () => {
            const data = {
                organizations: [
                    {
                        name: 'Org1',
                        members: [
                            { name: 'User1', isAdmin: true },
                            { name: 'User2', isAdmin: false }
                        ]
                    }
                ]
            };
            const query = new BooleanMatch('organizations[0].members[*].isAdmin', 'neq', false, data);
            // value-absent: members contain isAdmin=false, so neq false is false
            expect(query.isMatch).toBe(false);
        });

        it('應支援多層萬用字元 departments[*].teams[*].active', () => {
            const data = {
                departments: [
                    {
                        name: 'IT',
                        teams: [
                            { name: 'Dev', active: true },
                            { name: 'QA', active: true }
                        ]
                    },
                    {
                        name: 'HR',
                        teams: [
                            { name: 'Recruiting', active: false }
                        ]
                    }
                ]
            };
            const query = new BooleanMatch('departments[*].teams[*].active', 'neq', false, data);
            // value-absent: an active=false exists, so neq false is false
            expect(query.isMatch).toBe(false);
        });

        it('應處理空陣列路徑 emptyArray[*].active', () => {
            const data = {
                emptyArray: []
            };
            const query = new BooleanMatch('emptyArray[*].active', 'eq', true, data);
            expect(query.isMatch).toBe(false);
        });
    });

    describe('JSONPath 進階查詢測試', () => {
        it('應支援過濾表達式 - 布林值匹配 users[?(@.active==true)].active', () => {
            const data = {
                users: [
                    { name: 'Alice', active: true },
                    { name: 'Bob', active: false },
                    { name: 'Charlie', active: true }
                ]
            };
            const query = new BooleanMatch('users[?(@.active==true)].active', 'eq', true, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援遞迴搜尋 $..active', () => {
            const data = {
                departments: [
                    { users: [{ active: true }, { active: false }] },
                    { users: [{ active: true }] }
                ]
            };
            const query = new BooleanMatch('$..active', 'neq', false, data);
            // value-absent: an active=false exists in the tree, so neq false is false
            expect(query.isMatch).toBe(false);
        });

        it('應支援陣列切片查詢 users[0:2].verified', () => {
            const data = {
                users: [
                    { name: 'Alice', verified: true },
                    { name: 'Bob', verified: true },
                    { name: 'Charlie', verified: false },
                    { name: 'David', verified: true }
                ]
            };
            const query = new BooleanMatch('users[0:2].verified', 'eq', true, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援負數索引查詢 users[-1:].active', () => {
            const data = {
                users: [
                    { name: 'Alice', active: false },
                    { name: 'Bob', active: false },
                    { name: 'Charlie', active: true }
                ]
            };
            const query = new BooleanMatch('users[-1:].active', 'eq', true, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援多個索引聯合查詢 users[0,2].isAdmin', () => {
            const data = {
                users: [
                    { name: 'Alice', isAdmin: true },
                    { name: 'Bob', isAdmin: false },
                    { name: 'Charlie', isAdmin: true }
                ]
            };
            const query = new BooleanMatch('users[0,2].isAdmin', 'eq', true, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援複合萬用字元 departments[*].users[*].active', () => {
            const data = {
                departments: [
                    { users: [{ name: 'Alice', active: true }, { name: 'Bob', active: false }] },
                    { users: [{ name: 'Charlie', active: true }] }
                ]
            };
            const query = new BooleanMatch('departments[*].users[*].active', 'neq', false, data);
            // value-absent: an active=false exists, so neq false is false
            expect(query.isMatch).toBe(false);
        });

        it('應支援過濾表達式 - 存在性檢查 users[?(@.email)].verified', () => {
            const data = {
                users: [
                    { name: 'Alice', email: 'alice@example.com', verified: true },
                    { name: 'Bob', verified: false },
                    { name: 'Charlie', email: 'charlie@example.com', verified: true }
                ]
            };
            const query = new BooleanMatch('users[?(@.email)].verified', 'eq', true, data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援根路徑查詢 $.users[0].active', () => {
            const data = {
                users: [
                    { name: 'Alice', active: true },
                    { name: 'Bob', active: false }
                ]
            };
            const query = new BooleanMatch('$.users[0].active', 'eq', true, data);
            expect(query.isMatch).toBe(true);
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
