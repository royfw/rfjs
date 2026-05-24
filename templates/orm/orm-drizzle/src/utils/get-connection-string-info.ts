import { parse } from 'pg-connection-string';
import { getOptionsSchemas } from './get-options-schemas';

function buildSearchPathOption(schema: string): string {
  return `-c search_path=${schema}`;
}

function mergeOptions(existing: string | undefined, schema: string): string {
  const schemas = getOptionsSchemas(existing);
  if (schemas.length > 0) return existing ?? '';
  const add = buildSearchPathOption(schema);
  return existing && existing.trim() ? `${existing.trim()} ${add}` : add;
}

export function getConnectionStringInfo(
  connectionString: string,
  targetSchema?: string,
): {
  finalConnectionString: string;
  finalSchema: string;
  optionsSchemas: string[];
  hasSearchPath: boolean;
} {
  const config = parse(connectionString);
  const url = new URL(connectionString);

  // 這裡拿到的 options **是 decode 後的字串**（例如 "-c search_path=prisma_test"）
  const options = url.searchParams.get('options') ?? config.options ?? undefined;

  const optionsSchemas = getOptionsSchemas(options);
  const hasSearchPath = optionsSchemas.length > 0;

  const schemaParam = url.searchParams.get('schema') ?? undefined;

  // options search_path > schema param > targetSchema > public
  const finalSchema = optionsSchemas[0] ?? schemaParam ?? targetSchema ?? 'public';

  // (1) 有 schema，沒 search_path → 補 options
  if (!hasSearchPath && finalSchema !== 'public') {
    const merged = mergeOptions(options, finalSchema);
    // ✅ 不要 encodeURIComponent，URLSearchParams 會自動處理
    url.searchParams.set('options', merged);
  }

  // (2) 有 search_path，沒 schema → 補 schema
  if (!schemaParam && optionsSchemas.length > 0) {
    url.searchParams.set('schema', optionsSchemas[0]);
  }

  const finalConnectionString = url.toString();

  return {
    optionsSchemas,
    finalSchema,
    finalConnectionString,
    hasSearchPath,
  };
}
