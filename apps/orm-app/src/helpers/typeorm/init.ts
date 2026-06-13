import { createDb, DemoEntity, Repository } from '@rfjs/orm-typeorm';
import { configs } from '@/configs';

export const initDataSource = () => {
  console.log('Initializing Typeorm...');
  if (!configs.database.url) {
    throw new Error('DATABASE_URL is not defined');
  }
  const { db: dataSource } = createDb(configs.database.url);
  return dataSource;
};

export async function _testDataSource(): Promise<void> {
  const dataSource = initDataSource();
  try {
    await dataSource.initialize();
    const repo: Repository<DemoEntity> = dataSource.getRepository(DemoEntity);
    const data = await repo.find();
    console.log('data: ', data);
  } catch (error) {
    console.error('Error in _testDataSource:', error);
  } finally {
    await dataSource.destroy();
  }
}
