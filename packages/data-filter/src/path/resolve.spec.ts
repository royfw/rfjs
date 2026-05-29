import { describe, it, expect } from 'vitest';
import { resolvePath, resolvePathDetail } from './resolve';

describe('resolvePath', () => {
    const testData = {
        user: {
            name: 'John',
            age: 30,
        },
        users: [
            { name: 'John', age: 30, tags: ['A', 'B'] },
            { name: 'Jane', age: 25, tags: ['Z1', 'Z2'] },
            { name: 'Bob', age: 35, tags: ['C'] },
        ],
        items: [
            { price: 100, stock: 10 },
            { price: 200, stock: 5 },
            { price: 300, stock: 0 },
        ],
        metadata: {
            'tag,version': '1.0.0',  // 屬性名稱包含逗號
        },
    };

    describe('簡單路徑測試 (向後相容)', () => {
        it('應該正確解析簡單的巢狀路徑', () => {
            const result = resolvePath(testData, 'user.name');
            expect(result).toBe('John');
        });

        it('應該正確解析陣列索引', () => {
            const result = resolvePath(testData, 'users[0].name');
            expect(result).toBe('John');
        });

        it('應該對不存在的路徑返回 undefined', () => {
            const result = resolvePath(testData, 'user.notExist');
            expect(result).toBeUndefined();
        });

        it('應該正確處理 null 值', () => {
            const data = { value: null };
            const result = resolvePath(data, 'value');
            expect(result).toBeNull();
        });
    });

    describe('萬用字元查詢測試', () => {
        it('應該返回所有使用者的名稱', () => {
            const result = resolvePath(testData, 'users[*].name');
            expect(result).toEqual(['John', 'Jane', 'Bob']);
        });

        it('應該返回所有使用者的年齡', () => {
            const result = resolvePath(testData, 'users[*].age');
            expect(result).toEqual([30, 25, 35]);
        });

        it('應該處理多層巢狀萬用字元查詢', () => {
            const result = resolvePath(testData, 'users[*].tags[*]');
            expect(result).toEqual(['A', 'B', 'Z1', 'Z2', 'C']);
        });

        it('應該處理特定索引的萬用字元查詢', () => {
            const result = resolvePath(testData, 'users[1].tags[*]');
            expect(result).toEqual(['Z1', 'Z2']);
        });

        it('應該對空陣列返回空陣列', () => {
            const data = { items: [] };
            const result = resolvePath(data, 'items[*].name');
            expect(result).toEqual([]);
        });
    });

    describe('陣列索引聯合查詢測試', () => {
        it('應該返回指定索引的元素', () => {
            const result = resolvePath(testData, 'users[0,2].name');
            expect(result).toEqual(['John', 'Bob']);
        });

        it('應該處理多個索引的萬用字元', () => {
            const result = resolvePath(testData, 'users[0,1].tags[*]');
            expect(result).toEqual(['A', 'B', 'Z1', 'Z2']);
        });
    });

    describe('遞迴搜尋測試', () => {
        it('應該遞迴搜尋所有 name 屬性', () => {
            const result = resolvePath(testData, '$..name');
            expect(result).toContain('John');
            expect(result).toContain('Jane');
            expect(result).toContain('Bob');
            expect(result.length).toBeGreaterThanOrEqual(4); // user.name + 3 users
        });

        it('應該遞迴搜尋所有 age 屬性', () => {
            const result = resolvePath(testData, '$..age');
            expect(result).toContain(30);
            expect(result).toContain(25);
            expect(result).toContain(35);
        });
    });

    describe('陣列切片測試', () => {
        it('應該返回前兩個使用者', () => {
            const result = resolvePath(testData, 'users[0:2].name');
            expect(result).toEqual(['John', 'Jane']);
        });

        it('應該返回最後一個使用者', () => {
            const result = resolvePath(testData, 'users[-1:].name');
            expect(result).toEqual(['Bob']);
        });

        it('應該處理切片的萬用字元', () => {
            const result = resolvePath(testData, 'users[0:2].tags[*]');
            expect(result).toEqual(['A', 'B', 'Z1', 'Z2']);
        });
    });

    describe('過濾表達式測試', () => {
        it('應該過濾出年齡大於 25 的使用者', () => {
            const result = resolvePath(testData, 'users[?(@.age > 25)].name');
            expect(result).toEqual(['John', 'Bob']);
        });

        it('應該過濾出庫存大於 0 的商品', () => {
            const result = resolvePath(testData, 'items[?(@.stock > 0)].price');
            expect(result).toEqual([100, 200]);
        });

        it('應該過濾出價格等於 200 的商品', () => {
            const result = resolvePath(testData, 'items[?(@.price == 200)].stock');
            expect(result).toEqual([5]);
        });
    });

    describe('特殊情況:屬性名稱包含逗號', () => {
        it('應該使用 lodash 處理包含逗號的屬性名稱', () => {
            const result = resolvePath(testData, 'metadata.tag,version');
            expect(result).toBe('1.0.0');
        });

        it('應該區分方括號內的逗號', () => {
            // 方括號內的逗號是索引聯合查詢,不應該觸發 lodash 回退
            const result = resolvePath(testData, 'users[0,1].name');
            expect(result).toEqual(['John', 'Jane']);
        });
    });

    describe('錯誤處理測試', () => {
        it('應該正確解析帶點的屬性路徑', () => {
            // JSONPath 可以正確解析這個路徑
            const data = { a: { b: 'value' } };
            const result = resolvePath(data, 'a.b');
            expect(result).toBe('value');
        });

        it('應該在 fallbackToLodash=false 且發生錯誤時拋出錯誤', () => {
            // 使用真正會導致錯誤的 JSONPath 語法
            expect(() => {
                // 創建一個會導致 JSONPath 內部錯誤的情況
                // 傳入非物件作為 data 應該會導致錯誤
                resolvePath(
                    null as any,
                    'some.path',
                    { fallbackToLodash: false }
                );
            }).toThrow();
        });
    });

    describe('選項參數測試', () => {
        it('fallbackOnEmpty=false 應該對空結果返回 null', () => {
            const result = resolvePath(
                testData,
                'user.notExist',
                { fallbackOnEmpty: false }
            );
            expect(result).toBeNull();
        });

        it('fallbackOnEmpty=true 應該對空結果回退到 lodash', () => {
            const result = resolvePath(
                testData,
                'user.notExist',
                { fallbackOnEmpty: true }
            );
            expect(result).toBeUndefined();
        });

        it('萬用字元查詢不受 fallbackOnEmpty 影響', () => {
            const data = { items: [] };
            const result = resolvePath(
                data,
                'items[*].name',
                { fallbackOnEmpty: false }
            );
            expect(result).toEqual([]);
        });
    });
});

describe('resolvePathDetail', () => {
    const testData = {
        user: {
            name: 'John',
            age: 30,
        },
        users: [
            { name: 'John', age: 30 },
            { name: 'Jane', age: 25 },
        ],
        metadata: {
            'tag,version': '1.0.0',
        },
    };

    describe('詳細結果測試', () => {
        it('簡單路徑應該標記為使用 JSONPath', () => {
            const result = resolvePathDetail(testData, 'user.name');
            expect(result).toEqual({
                value: 'John',
                usedJsonPath: true,
                isWildcardResult: false,
            });
        });

        it('萬用字元查詢應該標記為萬用字元結果', () => {
            const result = resolvePathDetail(testData, 'users[*].name');
            expect(result).toEqual({
                value: ['John', 'Jane'],
                usedJsonPath: true,
                isWildcardResult: true,
            });
        });

        it('包含逗號的屬性名稱應該標記為使用 lodash', () => {
            const result = resolvePathDetail(testData, 'metadata.tag,version');
            expect(result).toEqual({
                value: '1.0.0',
                usedJsonPath: false,
                isWildcardResult: false,
            });
        });

        it('錯誤回退到 lodash 時應該標記正確', () => {
            const result = resolvePathDetail(
                testData,
                'user.notExist',
                { fallbackOnEmpty: true }
            );
            expect(result).toEqual({
                value: undefined,
                usedJsonPath: false,
                isWildcardResult: false,
            });
        });

        it('空結果不回退時應該標記為使用 JSONPath', () => {
            const result = resolvePathDetail(
                testData,
                'user.notExist',
                { fallbackOnEmpty: false }
            );
            expect(result).toEqual({
                value: null,
                usedJsonPath: true,
                isWildcardResult: false,
            });
        });
    });

    describe('選項參數測試', () => {
        it('應該正確處理 fallbackToLodash=false', () => {
            expect(() => {
                resolvePathDetail(
                    null as any,
                    'some.path',
                    { fallbackToLodash: false }
                );
            }).toThrow();
        });

        it('應該正確處理 fallbackOnEmpty 選項', () => {
            const result1 = resolvePathDetail(
                testData,
                'user.notExist',
                { fallbackOnEmpty: true }
            );
            expect(result1.usedJsonPath).toBe(false);

            const result2 = resolvePathDetail(
                testData,
                'user.notExist',
                { fallbackOnEmpty: false }
            );
            expect(result2.usedJsonPath).toBe(true);
        });
    });
});
