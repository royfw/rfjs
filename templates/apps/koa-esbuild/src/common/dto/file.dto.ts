import { IsNumber, IsString } from 'class-validator';
import { UploadFile, UploadFileInfo } from '@/common/types';
import { Transform } from 'class-transformer';

export class UploadFileInfoDTO implements UploadFileInfo {
  @IsString()
  fieldname: string;
  @Transform(({ value }) => Buffer.from(value, 'binary').toString('utf-8'))
  @IsString()
  originalname: string;
  @IsString()
  encoding: string;
  @IsString()
  mimetype: string;
  @IsNumber()
  size: number;
  @IsString()
  destination: string;
  @IsString()
  filename: string;
  @IsString()
  path: string;
}

export class UploadFileDTO extends UploadFileInfoDTO implements UploadFile {
  buffer: Buffer<ArrayBufferLike>;
}
