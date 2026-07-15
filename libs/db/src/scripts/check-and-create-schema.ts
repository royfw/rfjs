import { Client } from 'pg';

export async function checkAndCreateSchema(
  connectionString: string,
  schemas: string[],
): Promise<void> {
  const client = new Client(connectionString);
  let isConnected = false;

  try {
    await client.connect();
    isConnected = true;
    for (const schema of schemas) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.error(`Failed to ensure schema exists: ${error}`);
    throw error;
  } finally {
    if (isConnected) {
      await client.end();
    }
  }
}
