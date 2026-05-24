import { DemoEntity, DemoEntityInsert } from '@/entities';
import { DataSource } from 'typeorm';

const data: DemoEntityInsert[] = [
  {
    content: 'alice@prisma.io',
    complete: false,
  },
];

export async function seed(db: DataSource): Promise<void> {
  const repo = db.getRepository(DemoEntity);
  await repo.insert(data);
}
