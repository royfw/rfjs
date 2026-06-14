import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

export const datasetsTable = pgTable('datasets', {
  id: uuid('dataset_id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DatasetRow = typeof datasetsTable.$inferSelect;
export type NewDatasetRow = typeof datasetsTable.$inferInsert;
