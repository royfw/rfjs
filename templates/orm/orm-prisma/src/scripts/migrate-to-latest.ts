import { spawn } from 'child_process';
import { checkAndCreateDB } from './check-and-create-db';
import { checkAndCreateSchema } from './check-and-create-schema';
import { getConnectionStringInfo } from '@/utils';

export type PrismaMigrateToLatestParams = {
  connectionString: string;
  schema?: string;
  // 你可以用 schema.prisma 檔來決定 multi-schema / search_path / @@schema 等配置
  schemaFilePath?: string; // e.g. "prisma/schema.prisma"
  // Prisma v7 的 config 檔案路徑 (e.g. "prisma.config.ts")
  configFilePath?: string;
  // 如果你把 migrations 放在自訂資料夾，確保 prisma CLI 找得到它（通常是 prisma/migrations）
  cwd?: string; // monorepo/turbo libs 時常用
};

export async function migrateToLatest(
  params: PrismaMigrateToLatestParams,
): Promise<void> {
  const {
    connectionString,
    schema = 'public',
    schemaFilePath = 'prisma/schema.prisma',
    configFilePath,
    cwd,
  } = params;

  const { finalConnectionString, finalSchema, optionsSchemas } = getConnectionStringInfo(
    connectionString,
    schema,
  );

  const schemas = new Set<string>([finalSchema, ...optionsSchemas]);
  console.log('Get schemas:', [...schemas]);

  await checkAndCreateDB(finalConnectionString);
  await checkAndCreateSchema(finalConnectionString, [...schemas]);

  // Prisma migrate deploy 會讀 schema.prisma 的 datasource url
  // 最穩的做法：用 env 覆蓋 DATABASE_URL（避免你硬改檔案）
  // Prisma v7: 需要明確指定 --config 參數
  await runPrismaMigrateDeploy({
    databaseUrl: finalConnectionString,
    schemaFilePath,
    configFilePath,
    cwd,
  });
}

async function runPrismaMigrateDeploy(opts: {
  databaseUrl: string;
  schemaFilePath: string;
  configFilePath?: string;
  cwd?: string;
}) {
  const { databaseUrl, schemaFilePath, configFilePath, cwd } = opts;
  const { finalConnectionString } = getConnectionStringInfo(databaseUrl);
  process.env.DATABASE_URL = finalConnectionString;

  try {
    console.log('Running Prisma migrations (deploy)...');

    // 建立 CLI 參數陣列
    const args = ['prisma', 'migrate', 'deploy', '--schema', schemaFilePath];

    // Prisma v7: 如果有提供 configFilePath,加入 --config 參數
    if (configFilePath) {
      args.push('--config', configFilePath);
    }

    const child = spawn('npx', args, {
      stdio: 'inherit',
      cwd,
      env: {
        ...process.env,
        DATABASE_URL: finalConnectionString,
      },
    });

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Prisma migrate exited with code ${code}`));
        }
      });
      child.on('error', reject);
    });

    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Error during Prisma migration:');
    throw error;
  }
}
