import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { EnvService } from '../common/env';

type ComponentStatus = 'ok' | 'error' | 'warning';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService
  ) {}

  async getLiveness() {
    return {
      status: 'ok',
      now: new Date().toISOString()
    };
  }

  async getReadiness() {
    const checkedAt = new Date().toISOString();
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis()
    ]);

    const status = database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'error';

    return {
      status,
      checkedAt,
      components: {
        database,
        redis
      }
    };
  }

  async getOperationsHealth() {
    const checkedAt = new Date().toISOString();
    const [database, redis, queue, config] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueue(),
      Promise.resolve(this.getConfigHealth())
    ]);

    return {
      status: aggregateStatus([database.status, redis.status, queue.status, config.status]),
      checkedAt,
      components: {
        database,
        redis,
        queue,
        config
      },
      notes: [
        'worker/poller heartbeat is not implemented yet; this endpoint currently checks DB, Redis, queue, and required config only.'
      ]
    };
  }

  private async checkDatabase() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok' as const,
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        status: 'error' as const,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Database health check failed'
      };
    }
  }

  private async checkRedis() {
    const startedAt = Date.now();
    let redis: Redis | null = null;

    try {
      redis = new Redis(this.env.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1
      });

      await redis.connect();
      const ping = await redis.ping();

      return {
        status: ping === 'PONG' ? ('ok' as const) : ('error' as const),
        latencyMs: Date.now() - startedAt,
        message: ping === 'PONG' ? undefined : `Unexpected Redis ping response: ${ping}`
      };
    } catch (error) {
      return {
        status: 'error' as const,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Redis health check failed'
      };
    } finally {
      if (redis) {
        await redis.quit().catch(() => redis?.disconnect());
      }
    }
  }

  private async checkQueue() {
    const startedAt = Date.now();
    const queue = new Queue(this.env.queueName, {
      connection: buildRedisConnection(this.env.redisUrl)
    });

    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused');
      return {
        status: 'ok' as const,
        latencyMs: Date.now() - startedAt,
        queueName: this.env.queueName,
        counts
      };
    } catch (error) {
      return {
        status: 'error' as const,
        latencyMs: Date.now() - startedAt,
        queueName: this.env.queueName,
        message: error instanceof Error ? error.message : 'Queue health check failed'
      };
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  private getConfigHealth() {
    const notificationHubConfigured =
      !this.env.isPlaceholder(this.env.nhnAppKey) &&
      !this.env.isPlaceholder(this.env.nhnUserAccessKeyId) &&
      !this.env.isPlaceholder(this.env.nhnSecretAccessKey);
    const smsConfigured =
      !this.env.isPlaceholder(this.env.nhnSmsAppKey) &&
      !this.env.isPlaceholder(this.env.nhnSmsSecretKey);
    const alimtalkConfigured =
      !this.env.isPlaceholder(this.env.nhnAlimtalkAppKey) &&
      !this.env.isPlaceholder(this.env.nhnAlimtalkSecretKey);
    const webhookSecretConfigured = !this.env.isPlaceholder(this.env.nhnWebhookSignatureSecret);
    const defaultSenderGroupConfigured = !this.env.isPlaceholder(this.env.nhnDefaultSenderGroupKey);
    const status: ComponentStatus =
      notificationHubConfigured &&
      smsConfigured &&
      alimtalkConfigured &&
      webhookSecretConfigured &&
      defaultSenderGroupConfigured
        ? 'ok'
        : 'error';

    return {
      status,
      notificationHubConfigured,
      smsConfigured,
      alimtalkConfigured,
      webhookSecretConfigured,
      defaultSenderGroupConfigured,
      redisUrlConfigured: Boolean(this.env.redisUrl),
      queueNameConfigured: Boolean(this.env.queueName)
    };
  }
}

function buildRedisConnection(redisUrl: string) {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || '6379'),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1) || '0') : 0
  };
}

function aggregateStatus(statuses: ComponentStatus[]): 'ok' | 'degraded' | 'error' {
  if (statuses.includes('error')) {
    return 'error';
  }

  if (statuses.includes('warning')) {
    return 'degraded';
  }

  return 'ok';
}
