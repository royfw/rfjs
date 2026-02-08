import dotenvFlow from 'dotenv-flow';
import { readFileSync } from 'fs';
import { join } from 'path';

type PackageJsonType = {
  name: string;
  version: string;
  description: string;
  [key: string]: string | number | boolean | undefined;
};

const pkgPath = join(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJsonType;

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
  tz: process.env.TZ ?? null,
  name: pkg.name ?? process.env.APP_NAME,
  version: pkg.version,
  description: pkg.description ?? '',
};

export { configs };
