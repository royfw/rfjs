import dotenvFlow from 'dotenv-flow';

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
  name: process.env.APP_NAME || 'starter-ts-fastify',
  version: process.env.APP_VERSION || '0.0.0',
  description: process.env.APP_DESCRIPTION || 'A Fastify TypeScript server',
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  tz: process.env.TZ,
};

export { configs };
