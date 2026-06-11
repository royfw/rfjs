import { describe, it, expect } from 'vitest';
import { matchQueryArray } from '../filter/matchQuery';
import { FilterMatchQuery } from '../types';

describe('null, undefined object matchQueryArray', () => {
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2, 5, 6, 7]);
        });
    });
});
describe('object matchQueryArray', () => {
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
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
            const data = matchQueryArray(testData, filterQueries);
            const result = data.map((i) => i['id']);

            expect(result).toEqual([1, 2]);
        });
    });
});
