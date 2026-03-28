import { Injectable } from '@nestjs/common';
import { HealthService } from '../../health/health.service';

@Injectable()
export class V2OpsService {
  constructor(private readonly healthService: HealthService) {}

  async getHealth() {
    return this.healthService.getOperationsHealth();
  }
}
