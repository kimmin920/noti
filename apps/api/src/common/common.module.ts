import { Global, Module } from '@nestjs/common';
import { EnvService } from './env';

@Global()
@Module({
  providers: [EnvService],
  exports: [EnvService]
})
export class CommonModule {}
