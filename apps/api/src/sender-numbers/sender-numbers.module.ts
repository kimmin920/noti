import { Module } from '@nestjs/common';
import { SenderNumbersController } from './sender-numbers.controller';
import { SenderNumbersService } from './sender-numbers.service';

@Module({
  controllers: [SenderNumbersController],
  providers: [SenderNumbersService],
  exports: [SenderNumbersService]
})
export class SenderNumbersModule {}
