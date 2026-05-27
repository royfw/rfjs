import { filterMatchQueryArrayData } from '../filter/filterMatchQueryData';
import { FilterMatchQuery } from '../types';

describe('null, undefined object filterMatchQueryArrayData', () => {
    const testData = [
        {
            id: 1,
            code: 'A1000-xxxx',
            cost: 1000,
            deleted: false,
        },
        {
            id: 2,
            code: 'A1001-xxxx',
            deleted: false,
        },
        {
            id: 3,
            code: 'B1001-xxxx',
            cost: 100,
            deleted: true,
        },
        {
            id: 4,
            code: 'C1001-xxxx',
            cost: -100,
        },
        {
            id: 5,
            code: 'C1001-xxxx',
            cost: -1000,
            deleted: true,
        },
        {
            id: 6,
            code: 'A1001-xxxx',
            cost: -500,
        },
        {
            id: 7,
            code: 'A1001-xxxx',
            cost: -800,
            deleted: null,
        },
        {
            id: 8,
        },
    ];

    describe('empty filter', () => {
        it('empty filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        });
        it('empty filterQueries.filters', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        });
    });

    describe('nested filter', () => {
        it('logic and not nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        {
                            logic: 'not',
                            filters: [
                                // 345
                                {
                                    field: 'code',
                                    operator: 'contains',
                                    dataType: 'string',
                                    value: ['B10', 'C10'],
                                },
                                // 35
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 4, 6, 7, 8]);
        });

        it('logic and nor nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        {
                            logic: 'nor',
                            filters: [
                                {
                                    field: 'code',
                                    operator: 'contains',
                                    dataType: 'string',
                                    value: ['B10', 'C10'],
                                },
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 6, 7, 8]);
        });

        it('logic and nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        // 1,2,6,7
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A100',
                        },
                        // 5
                        {
                            logic: 'and',
                            filters: [
                                // 5, 6, 7
                                {
                                    field: 'cost',
                                    operator: 'range',
                                    dataType: 'numeric',
                                    value: [-500, -1000],
                                },
                                // 3, 4, 5
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([]);
        });

        it('logic or nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'or',
                    filters: [
                        // 1,2,6,7
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A100',
                        },
                        {
                            logic: 'and',
                            filters: [
                                // 5, 6
                                {
                                    field: 'cost',
                                    operator: 'range',
                                    dataType: 'numeric',
                                    value: [-500, -1000],
                                },
                                // 3, 4, 5
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 5, 6, 7]);
        });
    });
});
describe('object filterMatchQueryArrayData', () => {
    const testData = [
        {
            id: 1,
            code: 'A1000-xxxx',
            cost: 1000,
            deleted: false,
        },
        {
            id: 2,
            code: 'A1001-xxxx',
            cost: 500,
            deleted: false,
        },
        {
            id: 3,
            code: 'B1001-xxxx',
            cost: 100,
            deleted: true,
        },
        {
            id: 4,
            code: 'C1001-xxxx',
            cost: -100,
            deleted: true,
        },
        {
            id: 5,
            code: 'C1001-xxxx',
            cost: -1000,
            deleted: true,
        },
        {
            id: 6,
            code: 'A1001-xxxx',
            cost: -500,
            deleted: true,
        },
        {
            id: 7,
            code: 'A1001-xxxx',
            cost: -800,
            deleted: false,
        },
    ];

    describe('nested filter', () => {
        it('logic and not nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        {
                            logic: 'not',
                            filters: [
                                {
                                    field: 'code',
                                    operator: 'contains',
                                    dataType: 'string',
                                    value: ['B10', 'C10'],
                                },
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 6, 7]);
        });

        it('logic and nor nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        {
                            logic: 'nor',
                            filters: [
                                {
                                    field: 'code',
                                    operator: 'contains',
                                    dataType: 'string',
                                    value: ['B10', 'C10'],
                                },
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 7]);
        });

        it('logic and nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        // 1,2,6,7
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A100',
                        },
                        // 5, 6
                        {
                            logic: 'and',
                            filters: [
                                // 5, 6, 7
                                {
                                    field: 'cost',
                                    operator: 'range',
                                    dataType: 'numeric',
                                    value: [-500, -1000],
                                },
                                // 3, 4, 5, 6
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([6]);
        });

        it('logic or nested filter, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'or',
                    filters: [
                        // 1,2,6,7
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A100',
                        },
                        {
                            logic: 'and',
                            filters: [
                                // 5, 6
                                {
                                    field: 'cost',
                                    operator: 'range',
                                    dataType: 'numeric',
                                    value: [-500, -1000],
                                },
                                // 3, 4, 5, 6
                                {
                                    field: 'deleted',
                                    operator: 'eq',
                                    dataType: 'boolean',
                                    value: true,
                                },
                            ],
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 5, 6, 7]);
        });
    });

    describe('single filter', () => {
        it('logic and, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        // 5, 6, 7
                        {
                            field: 'cost',
                            operator: 'range',
                            dataType: 'numeric',
                            value: [-500, -1000],
                        },
                        // 3, 4, 5, 6
                        {
                            field: 'deleted',
                            operator: 'eq',
                            dataType: 'boolean',
                            value: true,
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([5, 6]);
        });

        it('logic and, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'and',
                    filters: [
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A1000',
                        },
                        {
                            field: 'cost',
                            operator: 'gte',
                            dataType: 'numeric',
                            value: 500,
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1]);
        });

        it('logic or, 1 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'or',
                    filters: [
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A1000',
                        },
                        {
                            field: 'cost',
                            operator: 'gte',
                            dataType: 'numeric',
                            value: 500,
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2]);
        });
    });

    describe('multi filterQueries', () => {
        it('logic and, 2 filterQueries', () => {
            const filterQueries: FilterMatchQuery[] = [
                {
                    logic: 'or',
                    filters: [
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A1000',
                        },
                        {
                            field: 'cost',
                            operator: 'gte',
                            dataType: 'numeric',
                            value: 500,
                        },
                    ],
                },
                {
                    logic: 'and',
                    filters: [
                        {
                            field: 'code',
                            operator: 'contains',
                            dataType: 'string',
                            value: 'A1000',
                        },
                        {
                            field: 'cost',
                            operator: 'gte',
                            dataType: 'numeric',
                            value: 500,
                        },
                    ],
                },
            ];
            const data = filterMatchQueryArrayData(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2]);
        });
    });
});


describe('JSONPath 進階查詢測試', () => {
    const testDataWithNested = [
        {
            id: 1,
            users: [
                { name: 'Alice', age: 30, tags: ['admin', 'developer'] },
                { name: 'Bob', age: 25, tags: ['user'] }
            ]
        },
        {
            id: 2,
            users: [
                { name: 'Charlie', age: 35, tags: ['admin'] },
                { name: 'David', age: 28, tags: ['developer', 'user'] }
            ]
        },
        {
            id: 3,
            users: [
                { name: 'Eve', age: 22, tags: ['user'] }
            ]
        }
    ];

    it('應支援萬用字元查詢 users[*].name', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'and',
                filters: [
                    {
                        field: 'users[*].name',
                        operator: 'contains',
                        dataType: 'string',
                        value: 'Alice'
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([1]);
    });

    it('應支援萬用字元數值查詢 users[*].age', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'and',
                filters: [
                    {
                        field: 'users[*].age',
                        operator: 'gt',
                        dataType: 'numeric',
                        value: 30
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([2]);
    });

    it('應支援陣列索引查詢 users[0].name', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'and',
                filters: [
                    {
                        field: 'users[0].name',
                        operator: 'eq',
                        dataType: 'string',
                        value: 'Alice'
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([1]);
    });

    it('應支援複合萬用字元 users[*].tags[*]', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'and',
                filters: [
                    {
                        field: 'users[*].tags[*]',
                        operator: 'terms',
                        dataType: 'string',
                        value: 'admin'
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([1, 2]);
    });

    it('應支援過濾表達式查詢 users[?(@.age>25)].name', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'and',
                filters: [
                    {
                        field: 'users[?(@.age>25)].name',
                        operator: 'contains',
                        dataType: 'string',
                        value: 'Charlie'
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([2]);
    });

    it('應支援陣列切片查詢 users[0:2].name', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'and',
                filters: [
                    {
                        field: 'users[0:2].name',
                        operator: 'contains',
                        dataType: 'string',
                        value: 'Bob'
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([1]);
    });

    it('應支援巢狀邏輯組合 - and 邏輯', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'and',
                filters: [
                    {
                        field: 'users[*].age',
                        operator: 'gte',
                        dataType: 'numeric',
                        value: 25
                    },
                    {
                        field: 'users[*].tags[*]',
                        operator: 'terms',
                        dataType: 'string',
                        value: 'admin'
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([1, 2]);
    });

    it('應支援巢狀邏輯組合 - or 邏輯', () => {
        const filterQueries: FilterMatchQuery[] = [
            {
                logic: 'or',
                filters: [
                    {
                        field: 'users[*].name',
                        operator: 'terms',
                        dataType: 'string',
                        value: 'Eve'
                    },
                    {
                        field: 'users[*].age',
                        operator: 'gt',
                        dataType: 'numeric',
                        value: 30
                    }
                ]
            }
        ];
        const result = filterMatchQueryArrayData(testDataWithNested, filterQueries);
        expect(result.map(i => i.id)).toEqual([2, 3]);
    });
});
