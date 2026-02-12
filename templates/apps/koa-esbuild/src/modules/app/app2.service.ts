import { BaseAppService } from './base';

export class App2Service extends BaseAppService {
  getAppData() {
    return {
      message: 'App2 is running smoothly',
    };
  }
}
