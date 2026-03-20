import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOauthStateService } from './google-oauth-state.service';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GoogleOauthStateService, SessionAuthGuard],
  exports: [SessionAuthGuard]
})
export class AuthModule {}
