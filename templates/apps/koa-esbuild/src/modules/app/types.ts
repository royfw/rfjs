export type AppInfo = {
  name: string;
  version: string;
};

export type AppData = {
  message: string;
};

export interface IAppService {
  getAppInfo(): AppInfo;
  getAppData(): AppData;
}
