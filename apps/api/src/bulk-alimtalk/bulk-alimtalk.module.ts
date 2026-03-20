import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { NhnModule } from '../nhn/nhn.module';
import { BulkAlimtalkController } from './bulk-alimtalk.controller';
import { BulkAlimtalkService } from './bulk-alimtalk.service';

@Module({
  imports: [PrismaModule, NhnModule],
  controllers: [BulkAlimtalkController],
  providers: [BulkAlimtalkService]
})
export class BulkAlimtalkModule {}
