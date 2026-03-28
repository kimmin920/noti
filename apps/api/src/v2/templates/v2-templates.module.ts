import { Module } from '@nestjs/common';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2TemplatesController } from './v2-templates.controller';
import { V2TemplatesService } from './v2-templates.service';

@Module({
  imports: [V2SharedModule],
  controllers: [V2TemplatesController],
  providers: [V2TemplatesService]
})
export class V2TemplatesModule {}
