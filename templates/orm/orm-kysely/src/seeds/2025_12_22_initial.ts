import { Kysely } from 'kysely';
import { Database } from '@/database';
import { InsertableUserRow } from '@/tables';

const userData: InsertableUserRow[] = [
  {
    name: 'Alice',
    email: 'alice@prisma.io',
  },
];

export async function seed(db: Kysely<Database>): Promise<void> {
  await db.insertInto('user').values(userData).execute();
}
