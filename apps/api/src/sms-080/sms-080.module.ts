import { Module } from '@nestjs/common';
import { Sms080ServicesService } from './sms-080.service';

@Module({
  providers: [Sms080ServicesService],
  exports: [Sms080ServicesService]
})
export class Sms080Module {}
