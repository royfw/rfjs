import { createDb } from '@rfjs/orm-prisma';
import { configs } from '@/configs';
import { migratePrisma } from '@/scripts/migrate-prisma';

export const initPrisma = () => {
  console.log('Initializing Prisma...');
  if (!configs.database.url) {
    throw new Error('DATABASE_URL is not defined');
  }
  const { db: prisma } = createDb(configs.database.url);
  return prisma;
};

export const _testInitPrisma = async () => {
  try {
    await migratePrisma();
    const prisma = initPrisma();
    const demos = await prisma.demo.findMany();
    console.log('demos: ', demos);
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error in _testInitPrisma:', error);
  }
};
