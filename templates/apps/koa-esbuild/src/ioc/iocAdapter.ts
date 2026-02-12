import { Action, ClassConstructor, IocAdapter } from 'routing-controllers';
import { DependencyContainer, container } from 'tsyringe';
import { IocRegistryApp } from './ioc.register.app';

export class TsyringeAdapter implements IocAdapter {
  container: DependencyContainer;
  constructor() {
    this.container = container;
    this.init();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get<T>(someClass: ClassConstructor<T>, _action?: Action): T {
    return this.container.resolve<T>(someClass);
  }

  private init() {
    new IocRegistryApp(this.container);
  }
}

const iocAdapter = new TsyringeAdapter();
export { iocAdapter };
