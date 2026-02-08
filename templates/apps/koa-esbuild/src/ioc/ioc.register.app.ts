import { BaseIocRegistry } from '@/utils/ioc';
import { IAppService } from '@/modules/app/types';
import { App2Service } from '@/modules/app/app2.service';
// import { AppService } from '@/modules/app/app.service';
import { DependencyContainer } from 'tsyringe';

export const INJECT_SVC_APP_SERVICE = 'IApp2Service';

export class IocRegistryApp extends BaseIocRegistry<DependencyContainer> {
  constructor(container: DependencyContainer) {
    super(container);
  }

  register(): void {
    this.container.registerSingleton<IAppService>(INJECT_SVC_APP_SERVICE, App2Service);
  }
}
