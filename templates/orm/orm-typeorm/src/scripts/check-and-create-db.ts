import { Client } from 'pg';
import { parse } from 'pg-connection-string';

export async function checkAndCreateDB(connectionString: string): Promise<void> {
  // Use pg-connection-string for more robust parsing and to generate admin connection string
  // Default fallback
  const config = parse(connectionString);
  const { user, password, host, port, database } = config;
  const adminConnectionString = `postgres://${user}:${password}@${host}:${port}/postgres`;
  const targetDb = database ?? 'orm';
  const client = new Client({
    connectionString: adminConnectionString,
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
      await client.query(`CREATE DATABASE "${targetDb}"`);
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
