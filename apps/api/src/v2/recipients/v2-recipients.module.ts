import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { V2RecipientsController } from './v2-recipients.controller';
import { V2RecipientsService } from './v2-recipients.service';

@Module({
  imports: [UsersModule],
  controllers: [V2RecipientsController],
  providers: [V2RecipientsService]
})
export class V2RecipientsModule {}
