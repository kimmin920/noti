import { Module } from '@nestjs/common';
import { NhnModule } from '../nhn/nhn.module';
import { EventRulesController } from './event-rules.controller';
import { EventRulesService } from './event-rules.service';

@Module({
  imports: [NhnModule],
  controllers: [EventRulesController],
  providers: [EventRulesService],
  exports: [EventRulesService]
})
export class EventRulesModule {}
