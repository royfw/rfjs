import { PrismaClient, DemoCreateInput } from '@/prisma';

const userData: DemoCreateInput[] = [
  {
    content: 'test demo',
    complete: false,
  },
];

export const seed = async (prisma: PrismaClient) => {
  console.log(`Start seeding ...`);

  // Clear existing data

  for (const u of userData) {
    const user = await prisma.demo.create({
      data: u,
    });
    console.log(`Created user with id: ${user.id}`);
  }
  console.log(`Seeding finished.`);
};
