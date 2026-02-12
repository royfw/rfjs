import { configs } from '@/configs';
import { EnumHealthStatus, HealthInfo } from './types';

export class HealthUseCase {
  getHealthStatus(): HealthInfo {
    const now = new Date();
    return {
      app: configs.name,
      version: configs.version,
      environment: configs.env,
      status: EnumHealthStatus.OK,
      timezone: configs.tz,
      timestamp: now,
    };
  }
}
