import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: uuid('user_id').defaultRandom().primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
});
