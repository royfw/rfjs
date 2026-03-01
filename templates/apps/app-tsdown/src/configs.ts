import dotenvFlow from 'dotenv-flow';
import pkg from '../package.json';

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
  name: pkg.name,
  description: pkg.description,
  version: pkg.version,
};

export { configs };
