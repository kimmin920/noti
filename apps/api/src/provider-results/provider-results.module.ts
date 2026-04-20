import { Module } from '@nestjs/common';
import { ProviderResultsService } from './provider-results.service';

@Module({
  providers: [ProviderResultsService],
  exports: [ProviderResultsService]
})
export class ProviderResultsModule {}
