import { inject, injectable } from 'tsyringe';
import { INJECT_SVC_APP_SERVICE } from '@/ioc';
import { IAppService } from './types';

@injectable()
export class AppUseCase {
  constructor(
    @inject(INJECT_SVC_APP_SERVICE)
    private readonly appService: IAppService,
  ) {}

  getApp() {
    return this.appService.getAppInfo();
  }

  getAppData() {
    return this.appService.getAppData();
  }
}
