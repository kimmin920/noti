import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { MESSAGE_JOB_NAME } from '@publ/shared';

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
    const options: JobsOptions = {
      attempts: 8,
      backoff: {
        type: 'publ_backoff'
      }
    };

    await this.queue.add(MESSAGE_JOB_NAME, { requestId }, options);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
