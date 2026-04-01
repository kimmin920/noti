import { Module } from '@nestjs/common';
import { V2PartnerController } from './v2-partner.controller';
import { V2PartnerService } from './v2-partner.service';

@Module({
  controllers: [V2PartnerController],
  providers: [V2PartnerService]
})
export class V2PartnerModule {}
