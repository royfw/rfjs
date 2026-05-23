export interface ServerManager<T> {
  start(): Promise<void>;
  stop(): Promise<void>;
  getServer(): T;
}
