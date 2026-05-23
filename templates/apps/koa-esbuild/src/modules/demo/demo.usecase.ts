import { getDemoValue } from '@/utils';

export class DemoUseCase {
  getDemoValue(): string {
    const data = getDemoValue();
    return data;
  }
}
