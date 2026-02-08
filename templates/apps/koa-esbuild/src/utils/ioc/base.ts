export abstract class BaseIocRegistry<T> {
  constructor(protected readonly container: T) {
    this.register();
  }
  abstract register(): Promise<void> | void;
}
