import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { NotionIntegrationsController } from './notion-integrations.controller';
import { NotionIntegrationsService } from './notion-integrations.service';
import { NotionOauthStateService } from './notion-oauth-state.service';

@Module({
  imports: [UsersModule],
  controllers: [NotionIntegrationsController],
  providers: [NotionIntegrationsService, NotionOauthStateService]
})
export class NotionIntegrationsModule {}
