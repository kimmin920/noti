import axios from 'axios';
import { Worker } from 'bullmq';
import { MessageChannel, PrismaClient } from '@prisma/client';
import { RESULT_CHECK_JOB_NAME } from '@publ/shared';

const prisma = new PrismaClient();

const intervalSeconds = Number(process.env.RESULT_POLLER_INTERVAL_SECONDS || 120);
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const queueName = process.env.BULLMQ_QUEUE_NAME || 'publ_messaging_queue';
const resultCheckQueueName = `${queueName}-result-check`;
const nhnBaseUrl = process.env.NHN_NOTIFICATION_HUB_BASE_URL || 'https://notification-hub.api.nhncloudservice.com';
const nhnOAuthUrl = process.env.NHN_OAUTH_BASE_URL || 'https://oauth.api.nhncloudservice.com';
const nhnAppKey = process.env.NHN_NOTIFICATION_HUB_APP_KEY || '';
const nhnUserAccessKeyId = process.env.NHN_USER_ACCESS_KEY_ID || '';
const nhnSecretAccessKey = process.env.NHN_SECRET_ACCESS_KEY || '';
const nhnAlimtalkBaseUrl = process.env.NHN_ALIMTALK_BASE_URL || 'https://api-alimtalk.cloud.toast.com';
const nhnAlimtalkAppKey = process.env.NHN_ALIMTALK_APP_KEY || '';
const nhnAlimtalkSecretKey = process.env.NHN_ALIMTALK_SECRET_KEY || '';

const isNotificationHubMockMode =
  !nhnAppKey ||
  !nhnUserAccessKeyId ||
  !nhnSecretAccessKey ||
  nhnAppKey.includes('__REPLACE_ME__') ||
  nhnUserAccessKeyId.includes('__REPLACE_ME__') ||
  nhnSecretAccessKey.includes('__REPLACE_ME__');

const isAlimtalkMockMode =
  !nhnAlimtalkAppKey ||
  !nhnAlimtalkSecretKey ||
  nhnAlimtalkAppKey.includes('__REPLACE_ME__') ||
  nhnAlimtalkSecretKey.includes('__REPLACE_ME__');

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getNhnAccessToken() {
  if (isNotificationHubMockMode) {
    return 'mock-access-token';
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const basic = Buffer.from(`${nhnUserAccessKeyId}:${nhnSecretAccessKey}`).toString('base64');
  const response = await axios.post(
    `${nhnOAuthUrl}/oauth2/token/create`,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  tokenCache = {
    token: response.data.access_token,
    expiresAt: now + Number(response.data.expires_in || 86400) * 1000
  };

  return tokenCache.token;
}

function mapProviderToInternalStatus(providerStatus: string): 'DELIVERED' | 'DELIVERY_FAILED' | null {
  const upper = providerStatus.toUpperCase();

  if (
    upper.includes('DELIVERED') ||
    upper === 'SUCCESS' ||
    upper === 'DONE' ||
    upper === 'COMPLETED' ||
    upper === 'MRC01'
  ) {
    return 'DELIVERED';
  }

  if (
    upper.includes('FAIL') ||
    upper.includes('REJECT') ||
    upper.includes('CANCEL') ||
    upper === 'MRC02' ||
    upper === 'MRC03' ||
    upper === 'MRC04'
  ) {
    return 'DELIVERY_FAILED';
  }

  return null;
}

function toIsoWithOffset(date: Date): string {
  return date.toISOString();
}

async function fetchDeliveryStatus(messageId: string, createdAt: Date) {
  if (isNotificationHubMockMode) {
    return {
      providerStatus: 'DELIVERED',
      providerCode: 'MOCK_OK',
      providerMessage: 'mock delivery result',
      payload: { mock: true }
    };
  }

  const token = await getNhnAccessToken();
  const from = new Date(createdAt.getTime() - 10 * 60 * 1000);
  const to = new Date(Date.now() + 60 * 1000);
  const response = await axios.get(`${nhnBaseUrl}/message/v1.0/contact-delivery-results`, {
    params: {
      createdDateTimeFrom: toIsoWithOffset(from),
      createdDateTimeTo: toIsoWithOffset(to),
      messageId,
      limit: 100
    },
    headers: {
      'X-NC-APP-KEY': nhnAppKey,
      'X-NHN-Authorization': `Bearer ${token}`
    }
  });

  const items = response.data?.contactDeliveryResults || response.data?.result || response.data?.data || [];
  const item = items.find((entry: { messageId?: string }) => entry.messageId === messageId) || {};

  return {
    providerStatus: String(item.deliveryStatus || item.status || 'PENDING'),
    providerCode: item.resultCode ? String(item.resultCode) : null,
    providerMessage: item.resultMessage ? String(item.resultMessage) : null,
    payload: item
  };
}

async function fetchAlimtalkDeliveryStatus(messageId: string) {
  if (isAlimtalkMockMode) {
    return {
      providerStatus: 'DELIVERED',
      providerCode: 'MOCK_OK',
      providerMessage: 'mock delivery result',
      payload: { mock: true }
    };
  }

  const [requestId, recipientSeq = '1'] = messageId.split(':');
  const response = await axios.get(
    `${nhnAlimtalkBaseUrl}/alimtalk/v2.3/appkeys/${nhnAlimtalkAppKey}/messages/${requestId}/${recipientSeq}`,
    {
      headers: {
        'X-Secret-Key': nhnAlimtalkSecretKey
      }
    }
  );

  const message = response.data?.message || {};
  return {
    providerStatus: String(message.messageStatus || message.resultCodeName || message.resultCode || 'PENDING'),
    providerCode: message.resultCode ? String(message.resultCode) : null,
    providerMessage: message.resultCodeName ? String(message.resultCodeName) : null,
    payload: message
  };
}

async function processStatusCheck(request: {
  id: string;
  createdAt: Date;
  nhnMessageId: string | null;
  resolvedChannel: MessageChannel | null;
}) {
  if (!request.nhnMessageId || !request.resolvedChannel) {
    return;
  }

  try {
    const result =
      request.resolvedChannel === MessageChannel.ALIMTALK
        ? await fetchAlimtalkDeliveryStatus(request.nhnMessageId)
        : await fetchDeliveryStatus(request.nhnMessageId, request.createdAt);

    await prisma.deliveryResult.create({
      data: {
        messageRequestId: request.id,
        providerStatus: result.providerStatus,
        providerCode: result.providerCode,
        providerMessage: result.providerMessage,
        payload: result.payload as never
      }
    });

    const next = mapProviderToInternalStatus(result.providerStatus);
    if (next) {
      await prisma.messageRequest.update({
        where: { id: request.id },
        data: {
          status: next,
          lastErrorCode: null,
          lastErrorMessage: null
        }
      });
    }
  } catch (error) {
    await prisma.messageRequest.update({
      where: { id: request.id },
      data: {
        lastErrorCode: 'RESULT_POLLER_ERROR',
        lastErrorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

async function runPoll() {
  const targets = await prisma.messageRequest.findMany({
    where: {
      status: 'SENT_TO_PROVIDER',
      nhnMessageId: { not: null }
    },
    orderBy: { updatedAt: 'asc' },
    take: 200
  });

  for (const request of targets) {
    await processStatusCheck(request);
  }

  if (targets.length > 0) {
    console.log(`[poller] processed ${targets.length} records`);
  }
}

function buildRedisConnection(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || '6379'),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1) || '0') : 0
  };
}

const resultCheckWorker = new Worker<{ requestId: string }>(
  resultCheckQueueName,
  async (job) => {
    if (job.name !== RESULT_CHECK_JOB_NAME) {
      return;
    }

    const requestId = String(job.data.requestId);
    const request = await prisma.messageRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        createdAt: true,
        nhnMessageId: true,
        resolvedChannel: true,
        status: true
      }
    });

    if (!request || request.status !== 'SENT_TO_PROVIDER') {
      return;
    }

    await processStatusCheck(request);
  },
  {
    connection: buildRedisConnection(redisUrl),
    concurrency: 10
  }
);

setInterval(() => {
  runPoll().catch((error) => {
    console.error('[poller] run failed', error);
  });
}, intervalSeconds * 1000);

runPoll().catch((error) => {
  console.error('[poller] bootstrap run failed', error);
});

process.on('SIGINT', async () => {
  await resultCheckWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log(`[poller] started (interval=${intervalSeconds}s)`);
