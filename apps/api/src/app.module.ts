import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BulkAlimtalkModule } from './bulk-alimtalk/bulk-alimtalk.module';
import { BulkSmsModule } from './bulk-sms/bulk-sms.module';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './database/prisma.module';
import { EventRulesModule } from './event-rules/event-rules.module';
import { HealthModule } from './health/health.module';
import { MessageRequestsModule } from './message-requests/message-requests.module';
import { NhnModule } from './nhn/nhn.module';
import { QueueModule } from './queue/queue.module';
import { SenderNumbersModule } from './sender-numbers/sender-numbers.module';
import { SenderProfilesModule } from './sender-profiles/sender-profiles.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';
import { V2Module } from './v2/v2.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    DashboardModule,
    BulkAlimtalkModule,
    BulkSmsModule,
    PrismaModule,
    QueueModule,
    NhnModule,
    AuthModule,
    HealthModule,
    MessageRequestsModule,
    TemplatesModule,
    EventRulesModule,
    SenderNumbersModule,
    SenderProfilesModule,
    UsersModule,
    WebhooksModule,
    V2Module
  ]
})
export class AppModule {}
