import { EnumErrorCode } from '@/common/enums';

export type HttpError = {
  status: number;
  type: string;
  message: string;
  description?: string;
  errorCode?: EnumErrorCode;
  error?: any;
  stack?: string;
};
