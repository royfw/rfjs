export interface TDataType<T> {
  new (...args: any[]): T;
}

export type ApiResStatus = {
  success: boolean;
  status: number;
};

export type ApiResData<T = any> = ApiResStatus & {
  data: T | T[] | null;
};

export type ApiResPaginated<T = any> = ApiResStatus & {
  total: number;
  data: T[];
};

export type ApiResError = ApiResStatus & {
  errorCode: string;
  message: string;
  description?: string;
  path?: string;
  timestamp?: Date;
  method?: string;
};

export type ApiResPaginatedParams<TData> = {
  success: boolean;
  status: number;
  total: number;
  data: TData[];
};

export type ApiResDataParams<TData> = {
  success: boolean;
  status: number;
  data: TData | TData[] | null;
};

export type ApiResErrorParams = ApiResError;
