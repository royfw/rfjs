import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/schema';

const userData: (typeof schema.usersTable.$inferInsert)[] = [
  {
    firstName: 'Alice',
    email: 'alice@prisma.io',
  },
];

export const seed = async (db: NodePgDatabase<typeof schema>): Promise<void> => {
  console.log(`Start seeding ...`);

  // Clear existing data
  for (const u of userData) {
    const user = await db.insert(schema.usersTable).values(u).returning();
    console.log(`Created user with id: ${user[0].id}`);
  }
  console.log(`Seeding finished.`);
};
