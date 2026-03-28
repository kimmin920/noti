import { Module } from '@nestjs/common';
import { EventRulesModule } from '../../event-rules/event-rules.module';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2EventsController } from './v2-events.controller';
import { V2EventsService } from './v2-events.service';

@Module({
  imports: [EventRulesModule, V2SharedModule],
  controllers: [V2EventsController],
  providers: [V2EventsService]
})
export class V2EventsModule {}
