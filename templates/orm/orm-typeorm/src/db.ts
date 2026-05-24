import { DataSource } from 'typeorm';
import * as entities from './entities';
import * as migrations from './migrations';
import { getConnectionStringInfo } from './utils';

type Ctor<T = any> = new (...args: any[]) => T;

export function createDb(
  connectionString: string,
  targetSchema?: string,
  logging?: boolean,
) {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );

  const entityClasses = (Object.values(entities) as unknown[]).filter(
    (v): v is Ctor => typeof v === 'function',
  );

  const migrationClasses = (Object.values(migrations) as unknown[]).filter(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    (v): v is Function => typeof v === 'function',
  );

  const dataSource = new DataSource({
    type: 'postgres',
    url: finalConnectionString,
    synchronize: false,
    logging,
    migrationsTableName: '__typeorm_migrations',
    entities: entityClasses,
    migrations: migrationClasses,
  });

  return { db: dataSource, hasSearchPath };
}
