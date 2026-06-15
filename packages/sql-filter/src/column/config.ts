export type ColumnType = 'text' | 'numeric' | 'timestamp' | 'boolean' | 'uuid';

export type ColumnConfig = Record<string, { column: string; type: ColumnType }>;
