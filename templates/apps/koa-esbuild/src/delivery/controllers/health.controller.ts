import { HealthInfoDTO } from '@/modules/health/dto';
import { HealthUseCase } from '@/modules/health/health.usecase';
import { Get, JsonController } from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import { inject, injectable } from 'tsyringe';

@JsonController()
@injectable()
export class HealthController {
  constructor(
    @inject(HealthUseCase)
    private readonly healthUseCase: HealthUseCase, // Assuming HealthUseCase is defined and injected
  ) {}

  @Get('/health')
  @ResponseSchema(HealthInfoDTO)
  getHealth() {
    return this.healthUseCase.getHealthStatus();
  }
}
