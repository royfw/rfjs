/** XML 屬性/文字轉義(& 必須最先換)。 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * raw id → 合法 NCName 的穩定對映:`<prefix>_<sanitized>`(前綴保證開頭合法),
 * 非 [A-Za-z0-9_.-] 一律換 `_`;sanitize 後撞名附 `_2`、`_3`…。
 */
export function makeIdMapper(prefix: string): (raw: string) => string {
  const byRaw = new Map<string, string>();
  const used = new Set<string>();
  return (raw: string): string => {
    const hit = byRaw.get(raw);
    if (hit !== undefined) return hit;
    const base = `${prefix}_${raw.replace(/[^A-Za-z0-9_.-]/g, "_")}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}_${n}`;
    byRaw.set(raw, id);
    used.add(id);
    return id;
  };
}
