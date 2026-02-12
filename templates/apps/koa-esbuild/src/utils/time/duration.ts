// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function duration<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => Promise<{ ms: number; result: Awaited<ReturnType<T>> }> {
  return async (
    ...args: Parameters<T>
  ): Promise<{ ms: number; result: Awaited<ReturnType<T>> }> => {
    const start: number = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: Awaited<ReturnType<T>> = await fn(...args);
    const end: number = Date.now();
    const ms: number = end - start;
    return { ms, result };
  };
}
