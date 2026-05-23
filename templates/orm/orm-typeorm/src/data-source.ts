import 'reflect-metadata';
import 'dotenv/config';

import { createDb } from '@/db';

// 給 CLI 用的：必須是 DataSource instance（不是 function）
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const { db } = createDb(process.env.DATABASE_URL);

export default db;
