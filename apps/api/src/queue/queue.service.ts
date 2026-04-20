import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { BULK_ALIMTALK_JOB_NAME, BULK_BRAND_MESSAGE_JOB_NAME, BULK_SMS_JOB_NAME, MESSAGE_JOB_NAME } from '@publ/shared';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const queueName = process.env.BULLMQ_QUEUE_NAME || 'publ_messaging_queue';
    const parsed = new URL(redisUrl);
    this.queue = new Queue(queueName, {
      connection: {
        host: parsed.hostname,
        port: Number(parsed.port || '6379'),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        db: parsed.pathname ? Number(parsed.pathname.slice(1) || '0') : 0
      },
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: false
      }
    });
  }

  async enqueueSendMessage(requestId: string): Promise<void> {
    await this.queue.add(MESSAGE_JOB_NAME, { requestId }, this.buildRetryableOptions(MESSAGE_JOB_NAME, requestId));
  }

  async enqueueSendMessageAt(requestId: string, scheduledAt: Date | null): Promise<void> {
    await this.queue.add(
      MESSAGE_JOB_NAME,
      { requestId },
      this.buildRetryableOptions(MESSAGE_JOB_NAME, requestId, scheduledAt)
    );
  }

  async enqueueBulkSmsCampaign(campaignId: string, scheduledAt: Date | null): Promise<void> {
    await this.queue.add(
      BULK_SMS_JOB_NAME,
      { campaignId },
      this.buildRetryableOptions(BULK_SMS_JOB_NAME, campaignId, scheduledAt, 5)
    );
  }

  async enqueueBulkAlimtalkCampaign(campaignId: string, scheduledAt: Date | null): Promise<void> {
    await this.queue.add(
      BULK_ALIMTALK_JOB_NAME,
      { campaignId },
      this.buildRetryableOptions(BULK_ALIMTALK_JOB_NAME, campaignId, scheduledAt, 5)
    );
  }

  async enqueueBulkBrandMessageCampaign(campaignId: string, scheduledAt: Date | null): Promise<void> {
    await this.queue.add(
      BULK_BRAND_MESSAGE_JOB_NAME,
      { campaignId },
      this.buildRetryableOptions(BULK_BRAND_MESSAGE_JOB_NAME, campaignId, scheduledAt, 5)
    );
  }

  private buildRetryableOptions(
    jobName: string,
    entityId: string,
    scheduledAt?: Date | null,
    attempts = 8
  ): JobsOptions {
    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;

    return {
      jobId: `${jobName}:${entityId}`,
      attempts,
      delay,
      backoff: {
        type: 'publ_backoff'
      }
    };
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
