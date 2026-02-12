import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  ApiResData,
  ApiResDataParams,
  ApiResError,
  ApiResPaginated,
  ApiResPaginatedParams,
} from '@/common/types';
import { JSONSchema } from 'class-validator-jsonschema';

export class ApiResDataDTO<TData> implements ApiResData<TData> {
  constructor(params: ApiResDataParams<TData>) {
    this.success = params.success;
    this.status = params.status;
    this.data = params.data == undefined ? null : params.data;
  }
  @JSONSchema({ description: '請求結果' })
  @IsBoolean()
  success: boolean;

  @JSONSchema({ description: '請求狀態' })
  @IsNumber()
  status: number;

  @JSONSchema({
    description: '回傳資料 T | T[] | null',
  })
  @IsObject()
  @IsOptional()
  data: TData | TData[] | null;
}

export class ApiResPaginatedDTO<TData> implements ApiResPaginated<TData> {
  constructor(params: ApiResPaginatedParams<TData>) {
    this.success = params.success;
    this.status = params.status;
    this.data = params.data == undefined ? [] : params.data;
    this.total = params.total;
  }
  @JSONSchema({ description: '請求結果' })
  @IsBoolean()
  success: boolean;

  @JSONSchema({ description: '請求狀態' })
  @IsNumber()
  status: number;

  @JSONSchema({ description: '回傳資料 T[]' })
  @IsArray()
  @IsOptional()
  data: TData[];

  @JSONSchema({ description: '總筆數' })
  @IsNumber()
  total: number;
}

export class ApiResErrorDTO implements ApiResError {
  constructor(
    success: boolean,
    status: number,
    errorCode: string,
    message: string,
    description?: string,
    path?: string,
    timestamp?: Date,
    method?: string,
  ) {
    this.success = success;
    this.status = status;
    this.errorCode = errorCode;
    this.message = message;
    this.description = description;
    this.path = path;
    this.timestamp = timestamp;
    this.method = method;
  }
  code: number;
  @JSONSchema({ description: '請求結果' })
  @IsBoolean()
  success: boolean;

  @JSONSchema({ description: '請求狀態' })
  @IsNumber()
  status: number;

  @JSONSchema({ description: '錯誤碼' })
  @IsString()
  errorCode: string;

  @JSONSchema({ description: '錯誤訊息' })
  @IsString()
  message: string;

  @JSONSchema({ description: '錯誤描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @JSONSchema({ description: '錯誤路徑' })
  @IsString()
  @IsOptional()
  path?: string;

  @JSONSchema({ description: '錯誤時間' })
  @IsDateString()
  @IsOptional()
  timestamp?: Date;

  @JSONSchema({ description: 'Http Method' })
  @IsString()
  @IsOptional()
  method?: string;
}
