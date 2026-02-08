import { BaseAppService } from './base';

export class AppService extends BaseAppService {
  getAppData() {
    return {
      message: 'App is running smoothly',
    };
  }
}
