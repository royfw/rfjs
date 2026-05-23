import dotenvFlow from 'dotenv-flow';

const flowEnv = dotenvFlow.config({
  node_env: process.env.NODE_ENV,
  default_node_env: 'development',
}).parsed;

process.env = {
  ...process.env,
  ...flowEnv,
};

const configs = {
  env: process.env.NODE_ENV,
  tz: process.env.TZ,
  name: process.env.APP_NAME,
};

export { configs };
