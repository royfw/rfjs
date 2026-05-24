import { IsDateString, IsString } from 'class-validator';

export class HealthInfoDTO {
  @IsString()
  app: string;
  @IsString()
  version: string;
  @IsString()
  environment: string;
  @IsString()
  status: string;
  @IsString()
  timezone: string;
  @IsDateString()
  timestamp: Date;
}
