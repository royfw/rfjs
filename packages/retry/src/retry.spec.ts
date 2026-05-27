import { retry } from './retry';

it('Test retry', async () => {
  let count = 0;
  const testFn = () => {
    while (count < 2) {
      count++;
      throw new Error();
    }
    return 2;
  };
  const result = await retry<number>(testFn, 1000);
  expect(result).toEqual(2);
});
