export const toDateString = (value: string | number): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`toDateString: invalid date value: ${JSON.stringify(value)}`);
  }
  return date.toISOString();
};
