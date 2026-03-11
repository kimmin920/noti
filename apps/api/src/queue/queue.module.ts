import { Global, Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [CommonModule],
  providers: [QueueService],
  exports: [QueueService]
})
export class QueueModule {}
