export const toBoolean = (value: boolean | string): boolean =>
  ['true', 'false'].includes(value as string)
    ? value === 'true'
    : Boolean(value);
