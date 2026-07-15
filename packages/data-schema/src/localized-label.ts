import type { LocalizedLabel } from './types';

export function resolveLabel(label: LocalizedLabel, locale: string, fallbackLocale?: string): string {
  if (typeof label === 'string') return label;
  if (label[locale] !== undefined) return label[locale];
  if (fallbackLocale !== undefined && label[fallbackLocale] !== undefined) return label[fallbackLocale];
  return Object.values(label)[0] ?? '';
}
