import { Global, Module } from '@nestjs/common';
import { CsrfOriginGuard } from './csrf-origin.guard';
import { EnvService } from './env';
import { ObjectStorageService } from './object-storage.service';
import { OperatorNotificationsService } from './operator-notifications.service';

@Global()
@Module({
  providers: [CsrfOriginGuard, EnvService, ObjectStorageService, OperatorNotificationsService],
  exports: [CsrfOriginGuard, EnvService, ObjectStorageService, OperatorNotificationsService]
})
export class CommonModule {}
