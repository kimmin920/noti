import { Global, Module } from '@nestjs/common';
import { NhnService } from './nhn.service';

@Global()
@Module({
  providers: [NhnService],
  exports: [NhnService]
})
export class NhnModule {}
