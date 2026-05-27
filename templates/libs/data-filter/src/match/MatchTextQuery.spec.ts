import { MatchTextQuery } from './MatchTextQuery';

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

    describe('MatchTextQuery', () => {
        describe('isnotnull', () => {
            it('undefined key: false', () => {
                const query = new MatchTextQuery(
                    'a2.string',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('null key: false', () => {
                const query = new MatchTextQuery(
                    'a1.nullText',
                    'isnotnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string: true', () => {
                const query = new MatchTextQuery(
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
                const query = new MatchTextQuery(
                    'a2.number',
                    'isnull',
                    null,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('nullText: true', () => {
                const query = new MatchTextQuery(
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
                const query = new MatchTextQuery(
                    'a2.number',
                    'endswith',
                    ['la', 'jour'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new MatchTextQuery(
                    'a1.nullText',
                    'endswith',
                    ['la', 'jour'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 2ture: true', () => {
                const query = new MatchTextQuery(
                    'a1.textArray',
                    'endswith',
                    ['la', 'jour'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('textArray item 2 - 2false: false', () => {
                const query = new MatchTextQuery(
                    'a1.textArray',
                    'endswith',
                    ['he', 'ho'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 1true 1false: true', () => {
                const query = new MatchTextQuery(
                    'a1.textArray',
                    'endswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2 - 1true 1false: true', () => {
                const query = new MatchTextQuery(
                    'a1.text',
                    'endswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2: true', () => {
                const query = new MatchTextQuery(
                    'a1.text',
                    'endswith',
                    ['hola', 'a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 1: false', () => {
                const query = new MatchTextQuery(
                    'a1.text',
                    'endswith',
                    ['ho'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('text item 1: true', () => {
                const query = new MatchTextQuery(
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
                const query = new MatchTextQuery(
                    'a2.number',
                    'startswith',
                    ['hel', 'bon'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new MatchTextQuery(
                    'a1.nullText',
                    'startswith',
                    ['hel', 'bon'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 2ture: true', () => {
                const query = new MatchTextQuery(
                    'a1.textArray',
                    'startswith',
                    ['hel', 'bon'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('textArray item 2 - 2false: false', () => {
                const query = new MatchTextQuery(
                    'a1.textArray',
                    'startswith',
                    ['lo', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('textArray item 2 - 1true 1false: true', () => {
                const query = new MatchTextQuery(
                    'a1.textArray',
                    'startswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2 - 1true 1false: true', () => {
                const query = new MatchTextQuery(
                    'a1.text',
                    'startswith',
                    ['ho', 'la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 2: true', () => {
                const query = new MatchTextQuery(
                    'a1.text',
                    'startswith',
                    ['hola', 'h'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('text item 1: false', () => {
                const query = new MatchTextQuery(
                    'a1.text',
                    'startswith',
                    ['la'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('text item 1: true', () => {
                const query = new MatchTextQuery(
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
                const query = new MatchTextQuery(
                    'a2.number',
                    'contains',
                    ['Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new MatchTextQuery(
                    'a1.nullText',
                    'contains',
                    ['Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 item: false', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'contains',
                    ['Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 item: true', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'contains',
                    ['C'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string: true', () => {
                const query = new MatchTextQuery(
                    'a1.contains',
                    'contains',
                    ['con'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string: false', () => {
                const query = new MatchTextQuery(
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
                const query = new MatchTextQuery(
                    'a2.number',
                    'terms',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new MatchTextQuery(
                    'a1.nullText',
                    'terms',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 0 match: false', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'terms',
                    'X',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 match: true', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'terms',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('stringArray 2 items - 2false: false', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'terms',
                    ['W', 'Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 2 items - 1 true, 1false: true', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'terms',
                    ['C1', 'Z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 2 items - 1true, 1false: true', () => {
                const query = new MatchTextQuery(
                    'a1.string',
                    'terms',
                    ['b', 'z'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 1: true', () => {
                const query = new MatchTextQuery(
                    'a1.string',
                    'terms',
                    ['b'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 2: true', () => {
                const query = new MatchTextQuery(
                    'string',
                    'terms',
                    ['a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 1: false', () => {
                const query = new MatchTextQuery(
                    'a1.string',
                    'terms',
                    ['a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 2 items: false', () => {
                const query = new MatchTextQuery(
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
                const query = new MatchTextQuery(
                    'a2.number',
                    'eq',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('nullText: false', () => {
                const query = new MatchTextQuery(
                    'a1.nullText',
                    'eq',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 0 match: false', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'eq',
                    'Z',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('stringArray 1 match: false', () => {
                const query = new MatchTextQuery(
                    'a1.stringArray',
                    'eq',
                    'D2',
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 2 items - 2false: false', () => {
                const query = new MatchTextQuery(
                    'a1.string',
                    'eq',
                    ['z', 'c'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 2 items - 1true, 1false: false', () => {
                const query = new MatchTextQuery(
                    'a1.string',
                    'eq',
                    ['b', 'c'],
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('string 1: true', () => {
                const query = new MatchTextQuery(
                    'a1.string',
                    'eq',
                    ['b'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 2: true', () => {
                const query = new MatchTextQuery(
                    'string',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });

            it('string 1: false', () => {
                const query = new MatchTextQuery(
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
                const query = new MatchTextQuery(
                    'a2.string',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.validPath).toEqual(false);
            });

            it('valid path', () => {
                const query = new MatchTextQuery(
                    'a1.string',
                    'eq',
                    ['a'],
                    testData1,
                );
                expect(query.validPath).toEqual(true);
            });
        });

        describe('萬用字元查詢支援', () => {
            it('應支援 users[*].userCode 萬用字元查詢', () => {
                const data = {
                    users: [
                        { userId: 1, userCode: "L1786", tags: ["A", "B"] },
                        { userId: 2, userCode: "L1787", tags: ["Z1", "Z2"] }
                    ]
                };
                const query = new MatchTextQuery('users[*].userCode', 'terms', 'L1786', data);
                // 應該找到至少一個匹配的
                expect(query.isMatch).toBe(true);
            });

            it('應支援 users[*].tags[*] 多層巢狀萬用字元查詢', () => {
                const data = {
                    users: [
                        { userId: 1, userCode: "L1786", tags: ["A", "B"] },
                        { userId: 2, userCode: "L1787", tags: ["Z1", "Z2"] }
                    ]
                };
                const query = new MatchTextQuery('users[*].tags[*]', 'terms', 'A', data);
                // 應該在所有標籤中找到 'A'
                expect(query.isMatch).toBe(true);
            });

            it('應支援 users[1].tags[*] 特定索引的萬用字元查詢', () => {
                const data = {
                    users: [
                        { userId: 1, userCode: "L1786", tags: ["A", "B"] },
                        { userId: 2, userCode: "L1787", tags: ["Z1", "Z2"] }
                    ]
                };
                const query = new MatchTextQuery('users[1].tags[*]', 'terms', 'Z1', data);
                // 應該在第二個使用者的標籤中找到 'Z1'
                expect(query.isMatch).toBe(true);
            });

            it('應支援 users[0].tags[*] 特定索引的萬用字元查詢', () => {
                const data = {
                    users: [
                        { userId: 1, userCode: "L1786", tags: ["A", "B"] },
                        { userId: 2, userCode: "L1787", tags: ["Z1", "Z2"] }
                    ]
                };
                const query = new MatchTextQuery('users[0].tags[*]', 'terms', 'B', data);
                // 應該在第一個使用者的標籤中找到 'B'
                expect(query.isMatch).toBe(true);
            });

            it('應支援深層巢狀路徑 data.users[*].profile.name', () => {
                const data = {
                    data: {
                        users: [
                            { userId: 1, profile: { name: "Alice" } },
                            { userId: 2, profile: { name: "Bob" } }
                        ]
                    }
                };
                const query = new MatchTextQuery('data.users[*].profile.name', 'terms', 'Alice', data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援混合路徑 categories[0].items[*].name', () => {
                const data = {
                    categories: [
                        {
                            name: 'Category1',
                            items: [
                                { name: 'Item1', code: 'I001' },
                                { name: 'Item2', code: 'I002' }
                            ]
                        }
                    ]
                };
                const query = new MatchTextQuery('categories[0].items[*].name', 'startswith', 'Item', data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援多層萬用字元 departments[*].teams[*].name', () => {
                const data = {
                    departments: [
                        {
                            name: 'IT',
                            teams: [
                                { name: 'Development', lead: 'Alice' },
                                { name: 'QA', lead: 'Bob' }
                            ]
                        },
                        {
                            name: 'HR',
                            teams: [
                                { name: 'Recruiting', lead: 'Charlie' }
                            ]
                        }
                    ]
                };
                const query = new MatchTextQuery('departments[*].teams[*].name', 'contains', 'Dev', data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援字串陣列比較 users[*].emails[*]', () => {
                const data = {
                    users: [
                        { userId: 1, emails: ['alice@example.com', 'alice@work.com'] },
                        { userId: 2, emails: ['bob@example.com'] }
                    ]
                };
                const query = new MatchTextQuery('users[*].emails[*]', 'endswith', '@work.com', data);
                expect(query.isMatch).toBe(true);
            });

            it('應處理空陣列路徑 emptyArray[*].text', () => {
                const data = {
                    emptyArray: []
                };
                const query = new MatchTextQuery('emptyArray[*].text', 'eq', 'test', data);
                expect(query.isMatch).toBe(false);
            });

            it('應支援特定索引後的萬用字元 posts[1].comments[*].author', () => {
                const data = {
                    posts: [
                        { id: 1, comments: [{ author: 'User1' }] },
                        { id: 2, comments: [{ author: 'User2' }, { author: 'User3' }] }
                    ]
                };
                const query = new MatchTextQuery('posts[1].comments[*].author', 'terms', 'User3', data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援三層萬用字元 organizations[*].departments[*].teams[*].name', () => {
                const data = {
                    organizations: [
                        {
                            name: 'Org1',
                            departments: [
                                {
                                    name: 'Dept1',
                                    teams: [
                                        { name: 'TeamAlpha' },
                                        { name: 'TeamBeta' }
                                    ]
                                }
                            ]
                        }
                    ]
                };
                const query = new MatchTextQuery('organizations[*].departments[*].teams[*].name', 'startswith', 'Team', data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援多個特定索引 users[1].roles[0]', () => {
                const data = {
                    users: [
                        { userId: 1, roles: ['admin', 'user'] },
                        { userId: 2, roles: ['guest', 'viewer'] }
                    ]
                };
                const query = new MatchTextQuery('users[1].roles[0]', 'eq', 'guest', data);
                expect(query.isMatch).toBe(true);
            });

            it('應支援混合索引和萬用字元 projects[0].tasks[*].assignees[*]', () => {
                const data = {
                    projects: [
                        {
                            name: 'Project1',
                            tasks: [
                                { id: 1, assignees: ['Alice', 'Bob'] },
                                { id: 2, assignees: ['Charlie'] }
                            ]
                        }
                    ]
                };
                const query = new MatchTextQuery('projects[0].tasks[*].assignees[*]', 'terms', 'Charlie', data);
                expect(query.isMatch).toBe(true);
            });
        });
    });

    describe('JSONPath 進階查詢測試', () => {
        it('應支援陣列切片查詢 users[0:2].name', () => {
            const data = {
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' },
                    { name: 'Charlie' },
                    { name: 'David' }
                ]
            };
            const query = new MatchTextQuery('users[0:2].name', 'terms', 'Alice', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援負數索引查詢 users[-1:].name', () => {
            const data = {
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' },
                    { name: 'Charlie' }
                ]
            };
            const query = new MatchTextQuery('users[-1:].name', 'eq', 'Charlie', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援負數範圍查詢 users[-2:].name', () => {
            const data = {
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' },
                    { name: 'Charlie' }
                ]
            };
            const query = new MatchTextQuery('users[-2:].name', 'terms', 'Bob', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援多個索引聯合查詢 users[0,2].name', () => {
            const data = {
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' },
                    { name: 'Charlie' },
                    { name: 'David' }
                ]
            };
            const query = new MatchTextQuery('users[0,2].name', 'terms', ['Alice', 'Charlie'], data);
            expect(query.isMatch).toBe(true);
        });

        it("應支援過濾表達式 - 字串匹配 users[?(@.status=='active')].name", () => {
            const data = {
                users: [
                    { name: 'Alice', status: 'active' },
                    { name: 'Bob', status: 'inactive' },
                    { name: 'Charlie', status: 'active' }
                ]
            };
            const query = new MatchTextQuery("users[?(@.status=='active')].name", 'terms', 'Alice', data);
            expect(query.isMatch).toBe(true);
        });

        it("應支援過濾表達式 - 多重條件 users[?(@.age>20 && @.status=='active')].name", () => {
            const data = {
                users: [
                    { name: 'Alice', age: 30, status: 'active' },
                    { name: 'Bob', age: 25, status: 'inactive' },
                    { name: 'Charlie', age: 18, status: 'active' },
                    { name: 'David', age: 35, status: 'active' }
                ]
            };
            const query = new MatchTextQuery("users[?(@.age>20 && @.status=='active')].name", 'terms', 'Alice', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援遞迴搜尋 $..name', () => {
            const data = {
                departments: [
                    { users: [{ name: 'Alice' }, { name: 'Bob' }] },
                    { users: [{ name: 'Charlie' }] }
                ]
            };
            const query = new MatchTextQuery('$..name', 'terms', 'Alice', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援遞迴搜尋字串匹配 $..email', () => {
            const data = {
                departments: [
                    { users: [{ email: 'alice@example.com' }, { email: 'bob@example.com' }] },
                    { users: [{ email: 'charlie@work.com' }] }
                ]
            };
            const query = new MatchTextQuery('$..email', 'endswith', '@work.com', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援複合萬用字元 departments[*].users[*].name', () => {
            const data = {
                departments: [
                    { users: [{ name: 'Alice' }, { name: 'Bob' }] },
                    { users: [{ name: 'Charlie' }] }
                ]
            };
            const query = new MatchTextQuery('departments[*].users[*].name', 'terms', 'Alice', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援步進切片 users[0:4:2].name', () => {
            const data = {
                users: [
                    { name: 'User1' },
                    { name: 'User2' },
                    { name: 'User3' },
                    { name: 'User4' }
                ]
            };
            const query = new MatchTextQuery('users[0:4:2].name', 'terms', ['User1', 'User3'], data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援根路徑查詢 $.users[0].name', () => {
            const data = {
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' }
                ]
            };
            const query = new MatchTextQuery('$.users[0].name', 'eq', 'Alice', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援過濾表達式 - 存在性檢查 users[?(@.email)].name', () => {
            const data = {
                users: [
                    { name: 'Alice', email: 'alice@example.com' },
                    { name: 'Bob' },
                    { name: 'Charlie', email: 'charlie@example.com' }
                ]
            };
            const query = new MatchTextQuery('users[?(@.email)].name', 'terms', 'Alice', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援萬用字元查詢物件屬性 data.*.value', () => {
            const data = {
                data: {
                    item1: { value: 'A' },
                    item2: { value: 'B' },
                    item3: { value: 'C' }
                }
            };
            const query = new MatchTextQuery('data.*.value', 'terms', 'B', data);
            expect(query.isMatch).toBe(true);
        });

        it('應支援最後一筆查詢 users[(@.length-1)].name', () => {
            const data = {
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' },
                    { name: 'Charlie' }
                ]
            };
            const query = new MatchTextQuery('users[(@.length-1)].name', 'eq', 'Charlie', data);
            expect(query.isMatch).toBe(true);
        });
    });
});
