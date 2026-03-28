import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: '헬스체크' })
  health() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get('health/live')
  @ApiOperation({ summary: 'Liveness check' })
  live() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness check' })
  async ready() {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status !== 'ok') {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }
}
