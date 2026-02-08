import { configs } from '@/configs';
import { IAppService } from './types';

export abstract class BaseAppService implements IAppService {
  getAppInfo() {
    return {
      name: configs.name,
      version: configs.version,
    };
  }
  getAppData() {
    return {
      message: 'BaseAppService getAppData',
    };
  }
}
