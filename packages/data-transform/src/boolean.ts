export const toBoolean = (value: boolean | string): boolean =>
  ['true', 'false'].includes(value as string)
    ? JSON.parse(value as string)
    : Boolean(value);
