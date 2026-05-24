import { Client, Pool } from 'pg';

const DEFAULT_TABLE_NAME = '__seed_history';

/**
 * 確保種子資料歷史紀錄表存在
 * @param client PG Client 或 Pool
 * @param tableName 資料表名稱 (預設: __seed_history)
 */
export async function ensureSeedHistoryTable(
  client: Client | Pool,
  tableName = DEFAULT_TABLE_NAME,
) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      "id" SERIAL PRIMARY KEY,
      "name" VARCHAR(255) NOT NULL UNIQUE,
      "executed_at" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/**
 * 檢查種子資料是否已執行過
 * @param client PG Client 或 Pool
 * @param name 種子資料名稱
 * @param tableName 資料表名稱 (預設: __seed_history)
 * @returns 是否已執行
 */
export async function checkSeedExecuted(
  client: Client | Pool,
  name: string,
  tableName = DEFAULT_TABLE_NAME,
): Promise<boolean> {
  const res = await client.query(`SELECT 1 FROM "${tableName}" WHERE "name" = $1`, [
    name,
  ]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * 紀錄種子資料執行紀錄
 * @param client PG Client 或 Pool
 * @param name 種子資料名稱
 * @param tableName 資料表名稱 (預設: __seed_history)
 */
export async function recordSeedExecution(
  client: Client | Pool,
  name: string,
  tableName = DEFAULT_TABLE_NAME,
) {
  await client.query(`INSERT INTO "${tableName}" ("name") VALUES ($1)`, [name]);
}
