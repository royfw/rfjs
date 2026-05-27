export const toBoolean = (value: boolean | string): boolean | object =>
  ['true', 'false'].includes(value as string)
    ? JSON.parse(value as string)
    : Boolean(value);
