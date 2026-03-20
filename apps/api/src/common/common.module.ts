import { Global, Module } from '@nestjs/common';
import { EnvService } from './env';
import { OperatorNotificationsService } from './operator-notifications.service';

@Global()
@Module({
  providers: [EnvService, OperatorNotificationsService],
  exports: [EnvService, OperatorNotificationsService]
})
export class CommonModule {}
