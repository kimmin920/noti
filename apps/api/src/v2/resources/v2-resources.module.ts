import { Module } from '@nestjs/common';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2ResourcesController } from './v2-resources.controller';
import { V2ResourcesService } from './v2-resources.service';

@Module({
  imports: [V2SharedModule],
  controllers: [V2ResourcesController],
  providers: [V2ResourcesService]
})
export class V2ResourcesModule {}
