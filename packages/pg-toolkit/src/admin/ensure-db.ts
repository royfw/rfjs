import { Client } from 'pg';
import { parse } from 'pg-connection-string';
import { quoteIdent } from '../pure/identifier';

export async function checkAndCreateDB(connectionString: string): Promise<void> {
  // Parse the target connection and connect to the `postgres` admin database
  // using structured fields. Re-serialising a URL string here would corrupt
  // credentials containing URL-special characters (e.g. `@`, `:`) and emit an
  // empty/`null` port when the source string omits one.
  const config = parse(connectionString);
  const targetDb = config.database ?? 'orm';
  const client = new Client({
    host: config.host ?? undefined,
    port: config.port ? Number(config.port) : undefined,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });
  let isConnected = false;

  try {
    await client.connect();
    isConnected = true;
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
      targetDb,
    ]);

    if (res.rowCount === 0) {
      console.log(`Database "${targetDb}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE ${quoteIdent(targetDb)}`);
      console.log(`Database "${targetDb}" created successfully.`);
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.error(`Failed to ensure database exists: ${error}`);
    throw error;
  } finally {
    if (isConnected) {
      await client.end();
    }
  }
}
