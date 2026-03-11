import axios, { AxiosError } from 'axios';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { MessageChannel, PrismaClient } from '@prisma/client';
import { RETRY_BACKOFF_SECONDS, RESULT_CHECK_JOB_NAME, jitterSeconds, MESSAGE_JOB_NAME, renderTemplate } from '@publ/shared';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const queueName = process.env.BULLMQ_QUEUE_NAME || 'publ_messaging_queue';
const resultCheckQueueName = `${queueName}-result-check`;
const nhnRateLimitRps = Number(process.env.NHN_RATE_LIMIT_RPS || 300);
const resultEarlyCheckDelaysSeconds = (process.env.RESULT_EARLY_CHECK_DELAYS_SECONDS || '10,30')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

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

function isRetryable(error: unknown): boolean {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (!status) {
      return true;
    }

    if (status === 429 || status >= 500) {
      return true;
    }

    return false;
  }

  return true;
}

function normalizeAlimtalkSendFailure(responseData: any): string | null {
  const headerResultCode = responseData?.header?.resultCode;
  if (typeof headerResultCode === 'number' && headerResultCode !== 0) {
    return String(responseData?.header?.resultMessage || `NHN header resultCode=${headerResultCode}`);
  }

  const sendResult = responseData?.message?.sendResults?.[0];
  if (sendResult && Number(sendResult.resultCode) !== 0) {
    return String(sendResult.resultMessage || `NHN send resultCode=${sendResult.resultCode}`);
  }

  return null;
}

function parseProviderRequest(data: unknown): unknown {
  if (typeof data !== 'string') {
    return data ?? undefined;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

async function sendToNhn(request: {
  channel: MessageChannel;
  recipientPhone: string;
  senderPhoneNumber?: string;
  senderKey?: string;
  senderProfileType?: string;
  templateCode?: string | null;
  renderedBody: string;
  variables: Record<string, string | number>;
}): Promise<{ messageId: string; providerResponse: unknown; providerRequest: unknown }> {
  if (request.channel === 'ALIMTALK') {
    if (isAlimtalkMockMode) {
      return {
        messageId: `mock_${Date.now()}:1`,
        providerResponse: { mock: true },
        providerRequest: request
      };
    }

    if (!request.senderKey || !request.templateCode) {
      throw new UnrecoverableError('senderKey and templateCode are required for ALIMTALK sending');
    }

    const payload = {
      senderKey: request.senderKey,
      templateCode: request.templateCode,
      recipientList: [
        {
          recipientNo: request.recipientPhone,
          templateParameter: Object.fromEntries(
            Object.entries(request.variables).map(([key, value]) => [key, value == null ? '' : String(value)])
          )
        }
      ]
    };

    const response = await axios.post(
      `${nhnAlimtalkBaseUrl}/alimtalk/v2.3/appkeys/${nhnAlimtalkAppKey}/messages`,
      payload,
      {
        timeout: 8000,
        headers: {
          'X-Secret-Key': nhnAlimtalkSecretKey,
          'Content-Type': 'application/json;charset=UTF-8'
        }
      }
    );

    const immediateFailure = normalizeAlimtalkSendFailure(response.data);
    if (immediateFailure) {
      throw new UnrecoverableError(immediateFailure);
    }

    const sendResult = response.data?.message?.sendResults?.[0];
    const requestId = String(response.data?.message?.requestId || `nhn_${Date.now()}`);
    const recipientSeq = Number(sendResult?.recipientSeq || 1);

    return {
      messageId: `${requestId}:${recipientSeq}`,
      providerResponse: response.data,
      providerRequest: payload
    };
  }

  if (isNotificationHubMockMode) {
    return {
      messageId: `mock_${Date.now()}`,
      providerResponse: { mock: true },
      providerRequest: request
    };
  }

  const accessToken = await getNhnAccessToken();

  const endpoint = '/message/v1.0/SMS/free-form-messages/NORMAL';

  const smsMessageType = Buffer.byteLength(request.renderedBody, 'utf8') <= 90 ? 'SMS' : 'LMS';

  const payload =
    request.channel === 'SMS'
      ? {
          sender: {
            senderPhoneNumber: request.senderPhoneNumber
          },
          recipients: [
            {
              contacts: [
                {
                  contactType: 'PHONE_NUMBER',
                  contact: request.recipientPhone,
                  clientReference: `request:${Date.now()}`
                }
              ]
            }
          ],
          content: {
            messageType: smsMessageType,
            body: request.renderedBody
          }
        }
      : undefined;

  const response = await axios.post(`${nhnBaseUrl}${endpoint}`, payload, {
    timeout: 8000,
    headers: {
      'X-NC-APP-KEY': nhnAppKey,
      'X-NHN-Authorization': `Bearer ${accessToken}`
    }
  });

  const messageId = String(
    response.data?.messageId ||
      response.data?.header?.resultMessage ||
      response.data?.header?.resultCode ||
      `nhn_${Date.now()}`
  );

  return {
    messageId,
    providerResponse: response.data,
    providerRequest: payload
  };
}

async function processMessage(job: Job<{ requestId: string }>) {
  if (job.name !== MESSAGE_JOB_NAME) {
    return;
  }

  const requestId = job.data.requestId;

  const messageRequest = await prisma.messageRequest.findUnique({
    where: { id: requestId },
    include: {
      resolvedTemplate: true,
      resolvedSenderNumber: true,
      resolvedSenderProfile: true,
      resolvedProviderTemplate: true
    }
  });

  if (!messageRequest) {
    return;
  }

  if (['DELIVERED', 'DELIVERY_FAILED', 'SEND_FAILED', 'CANCELED', 'DEAD'].includes(messageRequest.status)) {
    return;
  }

  await prisma.messageRequest.update({
    where: { id: requestId },
    data: {
      status: 'PROCESSING',
      attemptCount: { increment: 1 }
    }
  });

  try {
    const directBody = (messageRequest as { manualBody?: string | null }).manualBody ?? null;
    const metadata = (messageRequest.metadataJson as Record<string, unknown> | null) ?? null;
    const manualAlimtalkTemplate =
      metadata?.manualAlimtalkTemplate && typeof metadata.manualAlimtalkTemplate === 'object'
        ? (metadata.manualAlimtalkTemplate as Record<string, unknown>)
        : null;

    if (!directBody && !messageRequest.resolvedTemplate) {
      throw new UnrecoverableError('Resolved template is missing');
    }

    const variables = messageRequest.variablesJson as Record<string, string | number>;
    const renderedBody = directBody ?? renderTemplate(messageRequest.resolvedTemplate!.body, variables);

    if (messageRequest.resolvedChannel === 'ALIMTALK') {
      const isApprovedLocalTemplate = messageRequest.resolvedProviderTemplate?.providerStatus === 'APR';
      const isApprovedGroupTemplate =
        manualAlimtalkTemplate?.source === 'GROUP' && manualAlimtalkTemplate?.providerStatus === 'APR';

      if (!isApprovedLocalTemplate && !isApprovedGroupTemplate) {
        await prisma.messageRequest.update({
          where: { id: requestId },
          data: {
            status: 'SEND_FAILED',
            lastErrorCode: 'ALIMTALK_TEMPLATE_NOT_APPROVED',
            lastErrorMessage: 'APR template is required'
          }
        });

        throw new UnrecoverableError('ALIMTALK template is not approved');
      }
    }

    const result = await sendToNhn({
      channel: messageRequest.resolvedChannel!,
      recipientPhone: messageRequest.recipientPhone,
      senderPhoneNumber: messageRequest.resolvedSenderNumber?.phoneNumber,
      senderKey: messageRequest.resolvedSenderProfile?.senderKey,
      senderProfileType: messageRequest.resolvedSenderProfile?.senderProfileType,
      templateCode:
        messageRequest.resolvedProviderTemplate?.templateCode ||
        messageRequest.resolvedProviderTemplate?.kakaoTemplateCode ||
        messageRequest.resolvedProviderTemplate?.nhnTemplateId ||
        (typeof manualAlimtalkTemplate?.templateCode === 'string' ? manualAlimtalkTemplate.templateCode : null),
      renderedBody,
      variables
    });

    await prisma.messageAttempt.create({
      data: {
        messageRequestId: requestId,
        attemptNumber: messageRequest.attemptCount + 1,
        providerRequest: result.providerRequest as never,
        providerResponse: result.providerResponse as never
      }
    });

    await prisma.messageRequest.update({
      where: { id: requestId },
      data: {
        status: 'SENT_TO_PROVIDER',
        nhnMessageId: result.messageId,
        lastErrorCode: null,
        lastErrorMessage: null
      }
    });

    for (const delaySeconds of resultEarlyCheckDelaysSeconds) {
      await resultCheckQueue.add(
        RESULT_CHECK_JOB_NAME,
        { requestId },
        {
          delay: delaySeconds * 1000,
          jobId: `${requestId}:result-check:${delaySeconds}`,
          attempts: 1,
          removeOnComplete: 200,
          removeOnFail: false
        }
      );
    }
  } catch (error) {
    const retryable = isRetryable(error);
    const axiosError = error instanceof AxiosError ? error : null;

    await prisma.messageAttempt.create({
      data: {
        messageRequestId: requestId,
        attemptNumber: messageRequest.attemptCount + 1,
        providerRequest: parseProviderRequest(axiosError?.config?.data) as never,
        providerResponse: (axiosError?.response?.data as never) ?? undefined,
        errorCode: axiosError ? String(axiosError.response?.status || 'NETWORK') : 'WORKER_ERROR',
        errorMessage:
          axiosError?.response?.data?.header?.resultMessage ||
          axiosError?.response?.data?.message ||
          (error instanceof Error ? error.message : 'Unknown error')
      }
    });

    if (!retryable) {
      await prisma.messageRequest.update({
        where: { id: requestId },
        data: {
          status: 'SEND_FAILED',
          lastErrorCode: axiosError ? String(axiosError.response?.status || '4XX') : 'UNRECOVERABLE',
          lastErrorMessage:
            axiosError?.response?.data?.header?.resultMessage ||
            axiosError?.response?.data?.message ||
            (error instanceof Error ? error.message : 'Unknown error')
        }
      });

      throw new UnrecoverableError(error instanceof Error ? error.message : 'Unrecoverable');
    }

    throw error;
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

const connection = buildRedisConnection(redisUrl);
const resultCheckQueue = new Queue(resultCheckQueueName, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: false
  }
});

const worker = new Worker<{ requestId: string }>(queueName, processMessage, {
  connection,
  concurrency: nhnRateLimitRps,
  limiter: {
    max: nhnRateLimitRps,
    duration: 1000
  },
  settings: {
    backoffStrategy: (attemptsMade: number, type?: string) => {
      if (type === 'publ_backoff') {
        const index = Math.max(0, Math.min(RETRY_BACKOFF_SECONDS.length - 1, attemptsMade - 1));
        return jitterSeconds(RETRY_BACKOFF_SECONDS[index]) * 1000;
      }
      return 0;
    }
  }
});

worker.on('active', (job) => {
  console.log(`[worker] processing ${job.id} (${MESSAGE_JOB_NAME})`);
});

worker.on('completed', (job) => {
  console.log(`[worker] completed ${job.id}`);
});

worker.on('failed', async (job, error) => {
  console.error(`[worker] failed ${job?.id}:`, error.message);
  if (!job) {
    return;
  }

  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsMade >= attempts || error instanceof UnrecoverableError) {
    const requestId = String(job.data.requestId);

    await prisma.messageRequest.update({
      where: { id: requestId },
      data: {
        status: 'DEAD',
        lastErrorCode: 'DEAD',
        lastErrorMessage: error.message
      }
    });

    await prisma.deadLetter.create({
      data: {
        messageRequestId: requestId,
        queueName,
        payload: job.data as never,
        errorMessage: error.message
      }
    });
  }
});

process.on('SIGINT', async () => {
  await resultCheckQueue.close();
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[worker] started');
