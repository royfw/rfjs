import dotenvFlow from 'dotenv-flow';
import pkg from '../package.json';

// 載入環境變數
const flowEnv = dotenvFlow.config({
  node_env: process.env.NODE_ENV,
  default_node_env: 'development',
}).parsed;

process.env = {
  ...process.env,
  ...flowEnv,
};

// 應用程式配置介面
export interface AppConfig {
  env: string;
  name: string;
  version: string;
  description: string;
  host: string;
  port: number;
  tz?: string;
}

// 類型安全的配置物件
const configs: AppConfig = {
  env: process.env.NODE_ENV || 'development',
  name: pkg.name || 'starter-ts-fastify',
  version: pkg.version || '0.0.0',
  description: pkg.description || 'A Fastify TypeScript server',
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  tz: process.env.TZ,
};

export { configs };
