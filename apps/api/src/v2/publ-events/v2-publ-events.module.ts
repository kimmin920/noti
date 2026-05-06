import { Module } from '@nestjs/common';
import { V2PublEventsController } from './v2-publ-events.controller';
import { V2PublEventsService } from './v2-publ-events.service';

@Module({
  controllers: [V2PublEventsController],
  providers: [V2PublEventsService]
})
export class V2PublEventsModule {}
