/** 上傳 BPMN 檔案大小上限:1 MiB。 */
export const MAX_BPMN_BYTES = 1024 * 1024;
/** 允許的副檔名(小寫)。 */
export const ALLOWED_BPMN_EXTENSIONS = [".bpmn", ".xml"] as const;

export interface BpmnFileMeta {
  name: string;
  size: number;
}

export type BpmnFileValidation = { ok: true } | { ok: false; reason: "extension" | "size" | "empty" };

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_BPMN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateBpmnFile(meta: BpmnFileMeta): BpmnFileValidation {
  if (!hasAllowedExtension(meta.name)) return { ok: false, reason: "extension" };
  if (meta.size <= 0) return { ok: false, reason: "empty" };
  if (meta.size > MAX_BPMN_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}
