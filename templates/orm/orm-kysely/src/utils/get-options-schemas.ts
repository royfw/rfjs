/**
 * 從 options 解析 search_path
 * 支援：
 *   -c search_path=a,b
 *   -csearch_path=a,b   （防呆，但會 normalize）
 */
export function getOptionsSchemas(options?: string): string[] {
  if (!options) return [];

  // normalize: -csearch_path -> -c search_path
  const normalized = options.replace(/-csearch_path=/g, '-c search_path=');

  // match: search_path=a,b (到空白結束)
  const m = normalized.match(/(?:^|\s)search_path=([^\s]+)/);
  if (!m) return [];

  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
