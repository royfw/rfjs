import { IsString } from 'class-validator';
import { AppData, AppInfo } from './types';

export class AppDataDTO implements AppData {
  @IsString()
  message: string;
}

export class AppInfoDTO implements AppInfo {
  @IsString()
  name: string;

  @IsString()
  version: string;
}

export class AppPostBodyDTO {
  @IsString()
  message: string;
}
