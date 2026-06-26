import type { FieldConfig, FieldItem, FormConfig, FormItem, FormSection } from './types';

export function isFieldItem(item: FormItem): item is FieldItem {
  return item.kind === 'field';
}

export function fieldConfigToItem(f: FieldConfig): FieldItem {
  return { ...f, id: f.key, kind: 'field' };
}

export function normalizeToSections(config: FormConfig): FormSection[] {
  if (config.sections) return config.sections;
  return [{
    id: 'section-default',
    columns: config.columns,
    rows: (config.fields ?? []).map(f => ({ id: 'row-' + f.key, items: [fieldConfigToItem(f)] })),
  }];
}

export function collectFieldItems(config: FormConfig): FieldItem[] {
  return normalizeToSections(config)
    .flatMap(s => s.rows)
    .flatMap(r => r.items)
    .filter(isFieldItem);
}
