import type { FieldConfig, FormConfig } from './types';

export function addField(config: FormConfig, field: FieldConfig, index?: number): FormConfig {
  const fields = [...(config.fields ?? [])];
  const at = index === undefined ? fields.length : Math.max(0, Math.min(index, fields.length));
  fields.splice(at, 0, field);
  return { ...config, fields };
}

export function removeField(config: FormConfig, key: string): FormConfig {
  return { ...config, fields: (config.fields ?? []).filter((field) => field.key !== key) };
}

export function updateField(config: FormConfig, key: string, patch: Partial<FieldConfig>): FormConfig {
  return {
    ...config,
    fields: (config.fields ?? []).map((field) => (field.key === key ? { ...field, ...patch } : field)),
  };
}

export function moveField(config: FormConfig, from: number, to: number): FormConfig {
  const current = config.fields ?? [];
  if (from < 0 || from >= current.length) return config;
  const fields = [...current];
  const clampedTo = Math.max(0, Math.min(to, fields.length - 1));
  const [moved] = fields.splice(from, 1);
  fields.splice(clampedTo, 0, moved);
  return { ...config, fields };
}
