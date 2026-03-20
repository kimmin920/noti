import axios from 'axios';
import { Worker } from 'bullmq';
import { MessageChannel, PrismaClient } from '@prisma/client';
import { RESULT_CHECK_JOB_NAME } from '@publ/shared';

const prisma = new PrismaClient();

const intervalSeconds = Number(process.env.RESULT_POLLER_INTERVAL_SECONDS || 120);
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const queueName = process.env.BULLMQ_QUEUE_NAME || 'publ_messaging_queue';
const resultCheckQueueName = `${queueName}-result-check`;
const nhnSmsBaseUrl = process.env.NHN_SMS_BASE_URL || 'https://api-sms.cloud.toast.com';
const nhnSmsAppKey = process.env.NHN_SMS_APP_KEY || process.env.NHN_NOTIFICATION_HUB_APP_KEY || '';
const nhnSmsSecretKey = process.env.NHN_SMS_SECRET_KEY || '';
const nhnAlimtalkBaseUrl = process.env.NHN_ALIMTALK_BASE_URL || 'https://api-alimtalk.cloud.toast.com';
const nhnAlimtalkAppKey = process.env.NHN_ALIMTALK_APP_KEY || '';
const nhnAlimtalkSecretKey = process.env.NHN_ALIMTALK_SECRET_KEY || '';

const isSmsApiMockMode =
  !nhnSmsAppKey ||
  !nhnSmsSecretKey ||
  nhnSmsAppKey.includes('__REPLACE_ME__') ||
  nhnSmsSecretKey.includes('__REPLACE_ME__');

const isAlimtalkMockMode =
  !nhnAlimtalkAppKey ||
  !nhnAlimtalkSecretKey ||
  nhnAlimtalkAppKey.includes('__REPLACE_ME__') ||
  nhnAlimtalkSecretKey.includes('__REPLACE_ME__');

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

async function fetchSmsDeliveryStatus(messageId: string, messageType: 'SMS' | 'LMS' | 'MMS' = 'SMS') {
  if (isSmsApiMockMode) {
    return {
      providerStatus: 'DELIVERED',
      providerCode: 'MOCK_OK',
      providerMessage: 'mock delivery result',
      payload: { mock: true }
    };
  }

  const [requestId, recipientSeq = '1'] = messageId.split(':');
  const response = await axios.get(
    `${nhnSmsBaseUrl}/sms/v3.0/appKeys/${nhnSmsAppKey}/sender/${messageType === 'MMS' ? 'mms' : 'sms'}/${requestId}`,
    {
      params: {
        recipientSeq
      },
      headers: {
        'X-Secret-Key': nhnSmsSecretKey
      }
    }
  );

  if (response.data?.header?.isSuccessful === false) {
    throw new Error(response.data?.header?.resultMessage ?? 'NHN SMS delivery status lookup failed');
  }

  const body = response.data?.body?.data ?? response.data?.body ?? response.data;
  const item = Array.isArray(body?.data) ? body.data[0] : body;

  return {
    providerStatus: String(item?.dlrStatusName || item?.msgStatusName || item?.dlrStatus || item?.msgStatusCode || 'PENDING'),
    providerCode:
      item?.resultCode !== undefined && item?.resultCode !== null
        ? String(item.resultCode)
        : item?.dlrStatusCode
          ? String(item.dlrStatusCode)
          : null,
    providerMessage:
      item?.resultMessage
        ? String(item.resultMessage)
        : item?.dlrStatusName
          ? String(item.dlrStatusName)
          : item?.msgStatusName
            ? String(item.msgStatusName)
            : null,
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
  scheduledAt: Date | null;
  nhnMessageId: string | null;
  resolvedChannel: MessageChannel | null;
  metadataJson?: unknown;
}) {
  if (!request.nhnMessageId || !request.resolvedChannel) {
    return;
  }

  if (request.scheduledAt && request.scheduledAt.getTime() > Date.now()) {
    return;
  }

  try {
    const metadata =
      request.metadataJson && typeof request.metadataJson === 'object'
        ? (request.metadataJson as Record<string, unknown>)
        : null;
    const smsMessageType = metadata?.smsMessageType === 'MMS' ? 'MMS' : 'SMS';
    const result =
      request.resolvedChannel === MessageChannel.ALIMTALK
        ? await fetchAlimtalkDeliveryStatus(request.nhnMessageId)
        : await fetchSmsDeliveryStatus(request.nhnMessageId, smsMessageType);

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
  const now = new Date();
  const targets = await prisma.messageRequest.findMany({
    where: {
      status: 'SENT_TO_PROVIDER',
      nhnMessageId: { not: null },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }]
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
        scheduledAt: true,
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
