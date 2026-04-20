import { promises as fs } from 'fs';
import path from 'path';
import axios, { AxiosError } from 'axios';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { MessageChannel, Prisma, PrismaClient } from '@prisma/client';
import {
  BULK_ALIMTALK_JOB_NAME,
  BULK_BRAND_MESSAGE_JOB_NAME,
  buildDomesticMmsTitle,
  BULK_SMS_JOB_NAME,
  classifyDomesticSmsBody,
  formatSmsBody,
  formatNhnRequestDate,
  RETRY_BACKOFF_SECONDS,
  jitterSeconds,
  MESSAGE_JOB_NAME,
  renderTemplate
} from '@publ/shared';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const queueName = process.env.BULLMQ_QUEUE_NAME || 'publ_messaging_queue';
const nhnRateLimitRps = Number(process.env.NHN_RATE_LIMIT_RPS || 300);

const nhnSmsBaseUrl = process.env.NHN_SMS_BASE_URL || 'https://api-sms.cloud.toast.com';
const nhnSmsAppKey = process.env.NHN_SMS_APP_KEY || process.env.NHN_NOTIFICATION_HUB_APP_KEY || '';
const nhnSmsSecretKey = process.env.NHN_SMS_SECRET_KEY || '';
const nhnAlimtalkBaseUrl = process.env.NHN_ALIMTALK_BASE_URL || 'https://api-alimtalk.cloud.toast.com';
const nhnAlimtalkAppKey = process.env.NHN_ALIMTALK_APP_KEY || '';
const nhnAlimtalkSecretKey = process.env.NHN_ALIMTALK_SECRET_KEY || '';

const isAlimtalkMockMode =
  !nhnAlimtalkAppKey ||
  !nhnAlimtalkSecretKey ||
  nhnAlimtalkAppKey.includes('__REPLACE_ME__') ||
  nhnAlimtalkSecretKey.includes('__REPLACE_ME__');

const isSmsApiMockMode =
  !nhnSmsAppKey ||
  !nhnSmsSecretKey ||
  nhnSmsAppKey.includes('__REPLACE_ME__') ||
  nhnSmsSecretKey.includes('__REPLACE_ME__');

function ensureSmsApiConfig() {
  if (isSmsApiMockMode) {
    throw new UnrecoverableError('NHN_SMS_APP_KEY and NHN_SMS_SECRET_KEY must be configured');
  }
}

function ensureAlimtalkApiConfig() {
  if (isAlimtalkMockMode) {
    throw new UnrecoverableError('NHN_ALIMTALK_APP_KEY and NHN_ALIMTALK_SECRET_KEY must be configured');
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof UnrecoverableError) {
    return false;
  }

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

function normalizeBizmessageSendFailure(responseData: any): string | null {
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

function normalizeNhnTemplateBody(body: string) {
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g, (_, mustacheKey: string | undefined, hashKey: string | undefined) => {
    const key = (mustacheKey ?? hashKey ?? '').trim();
    return key ? `##${key}##` : '';
  });
}

function parseTemplateParameters(
  value: unknown
): Record<string, string> | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, item]) => [key, item == null ? '' : String(item)] as const)
    .filter(([key]) => Boolean(key));

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function normalizePhoneNumber(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

interface StoredManualSmsAttachment {
  filePath: string;
  originalName: string;
  mimeType?: string | null;
  size?: number | null;
}

function parseStoredSmsAttachments(value: unknown): StoredManualSmsAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .flatMap((item) => {
      if (!item || typeof item.filePath !== 'string') {
        return [];
      }

      return [
        {
          filePath: item.filePath,
          originalName:
            typeof item.originalName === 'string' && item.originalName.trim()
              ? item.originalName
              : path.basename(item.filePath),
          mimeType: typeof item.mimeType === 'string' ? item.mimeType : null,
          size: typeof item.size === 'number' ? item.size : null
        }
      ];
    });
}

async function uploadSmsAttachmentToNhn(attachment: StoredManualSmsAttachment): Promise<number> {
  let fileBody: Buffer;

  try {
    fileBody = await fs.readFile(attachment.filePath);
  } catch (error) {
    throw new UnrecoverableError(
      error instanceof Error
        ? `MMS attachment file could not be read: ${error.message}`
        : 'MMS attachment file could not be read'
    );
  }

  const response = await axios.post(
    `${nhnSmsBaseUrl}/sms/v3.0/appKeys/${nhnSmsAppKey}/attachfile/binaryUpload`,
    {
      fileName: attachment.originalName || path.basename(attachment.filePath),
      createUser: 'publ-worker',
      fileBody: fileBody.toString('base64')
    },
    {
      timeout: 8000,
      headers: {
        'X-Secret-Key': nhnSmsSecretKey,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    }
  );

  if (response.data?.header?.isSuccessful === false) {
    throw new UnrecoverableError(response.data?.header?.resultMessage ?? 'NHN MMS attachment upload failed');
  }

  const body = response.data?.body?.data ?? response.data?.body ?? response.data;
  const fileId = body?.fileId ?? response.data?.fileId;

  if (fileId === undefined || fileId === null) {
    throw new UnrecoverableError('NHN MMS attachment upload response did not include fileId');
  }

  return Number(fileId);
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
  scheduledAt?: Date | null;
  smsMessageType?: 'SMS' | 'LMS' | 'MMS';
  mmsTitle?: string | null;
  attachments?: StoredManualSmsAttachment[] | null;
  smsFailover?: {
    senderNo: string;
    msgSms: string;
    smsKind: 'SMS' | 'LMS';
  } | null;
  brandMessage?: {
    mode?: 'FREESTYLE' | 'TEMPLATE';
    targeting: 'I' | 'M' | 'N';
    messageType?:
      | 'TEXT'
      | 'IMAGE'
      | 'WIDE'
      | 'WIDE_ITEM_LIST'
      | 'CAROUSEL_FEED'
      | 'PREMIUM_VIDEO'
      | 'COMMERCE'
      | 'CAROUSEL_COMMERCE'
      | null;
    pushAlarm: boolean;
    adult: boolean;
    statsId?: string | null;
    resellerCode?: string | null;
    templateCode?: string | null;
    buttons?: Array<{
      type: 'WL' | 'AL' | 'BK' | 'MD';
      name: string;
      linkMo?: string | null;
      linkPc?: string | null;
      schemeIos?: string | null;
      schemeAndroid?: string | null;
    }> | null;
    image?: {
      imageUrl?: string | null;
      imageLink?: string | null;
    } | null;
  } | null;
}): Promise<{ messageId: string; providerResponse: unknown; providerRequest: unknown }> {
  if (request.channel === 'BRAND_MESSAGE') {
    ensureAlimtalkApiConfig();

    if (!request.senderKey || !request.brandMessage) {
      throw new UnrecoverableError('senderKey and brandMessage config are required for brand message sending');
    }

    const isTemplateMode = request.brandMessage.mode === 'TEMPLATE';
    const payload = isTemplateMode
      ? {
          senderKey: request.senderKey,
          templateCode: request.brandMessage.templateCode,
          ...(request.scheduledAt ? { requestDate: formatNhnRequestDate(request.scheduledAt) } : {}),
          pushAlarm: request.brandMessage.pushAlarm,
          adult: request.brandMessage.adult,
          ...(request.brandMessage.statsId ? { statsId: request.brandMessage.statsId } : {}),
          ...(request.brandMessage.resellerCode ? { resellerCode: request.brandMessage.resellerCode } : {}),
          recipientList: [
            {
              recipientNo: request.recipientPhone,
              targeting: request.brandMessage.targeting,
              ...(Object.keys(request.variables).length > 0
                ? {
                    templateParameter: Object.fromEntries(
                      Object.entries(request.variables).map(([key, value]) => [key, value == null ? '' : String(value)])
                    )
                  }
                : {})
            }
          ]
        }
      : {
          senderKey: request.senderKey,
          ...(request.scheduledAt ? { requestDate: formatNhnRequestDate(request.scheduledAt) } : {}),
          chatBubbleType: request.brandMessage.messageType,
          content: request.renderedBody,
          pushAlarm: request.brandMessage.pushAlarm,
          adult: request.brandMessage.adult,
          ...(request.brandMessage.statsId ? { statsId: request.brandMessage.statsId } : {}),
          ...(request.brandMessage.resellerCode ? { resellerCode: request.brandMessage.resellerCode } : {}),
          ...(request.brandMessage.buttons?.length ? { buttons: request.brandMessage.buttons } : {}),
          ...(request.brandMessage.image?.imageUrl
            ? {
                image: {
                  imageUrl: request.brandMessage.image.imageUrl,
                  imageLink: request.brandMessage.image.imageLink ?? null
                }
              }
            : {}),
          recipientList: [
            {
              recipientNo: request.recipientPhone,
              targeting: request.brandMessage.targeting
            }
          ]
        };

    if (isTemplateMode && !request.brandMessage.templateCode) {
      throw new UnrecoverableError('templateCode is required for brand template sending');
    }

    const response = await axios.post(
      `${nhnAlimtalkBaseUrl}/brand-message/v1.0/appkeys/${nhnAlimtalkAppKey}/${isTemplateMode ? 'basic-messages' : 'freestyle-messages'}`,
      payload,
      {
        timeout: 8000,
        headers: {
          'X-Secret-Key': nhnAlimtalkSecretKey,
          'Content-Type': 'application/json;charset=UTF-8'
        }
      }
    );

    const immediateFailure = normalizeBizmessageSendFailure(response.data);
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

  if (request.channel === 'ALIMTALK') {
    ensureAlimtalkApiConfig();

    if (!request.senderKey || !request.templateCode) {
      throw new UnrecoverableError('senderKey and templateCode are required for ALIMTALK sending');
    }

    const payload = {
      senderKey: request.senderKey,
      templateCode: request.templateCode,
      ...(request.scheduledAt ? { requestDate: formatNhnRequestDate(request.scheduledAt) } : {}),
      ...(request.smsFailover
        ? {
            useSmsFailover: true,
            senderNo: request.smsFailover.senderNo,
            msgSms: request.smsFailover.msgSms,
            smsKind: request.smsFailover.smsKind
          }
        : {}),
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

    const immediateFailure = normalizeBizmessageSendFailure(response.data);
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

  ensureSmsApiConfig();

  if (!request.senderPhoneNumber) {
    throw new UnrecoverableError('senderPhoneNumber is required for SMS sending');
  }

  const hasAttachments = (request.attachments?.length ?? 0) > 0 || request.smsMessageType === 'MMS';

  if (hasAttachments) {
    const attachFileIdList =
      request.attachments && request.attachments.length > 0
        ? await Promise.all(request.attachments.map((attachment) => uploadSmsAttachmentToNhn(attachment)))
        : [];
    const payload = {
      title: buildDomesticMmsTitle(request.renderedBody, request.mmsTitle),
      body: request.renderedBody,
      sendNo: normalizePhoneNumber(request.senderPhoneNumber) || request.senderPhoneNumber,
      ...(request.scheduledAt ? { requestDate: formatNhnRequestDate(request.scheduledAt) } : {}),
      ...(attachFileIdList.length > 0 ? { attachFileIdList } : {}),
      recipientList: [
        {
          recipientNo: request.recipientPhone
        }
      ]
    };

    const response = await axios.post(
      `${nhnSmsBaseUrl}/sms/v3.0/appKeys/${nhnSmsAppKey}/sender/mms`,
      payload,
      {
        timeout: 8000,
        headers: {
          'X-Secret-Key': nhnSmsSecretKey
        }
      }
    );

    if (response.data?.header?.isSuccessful === false) {
      throw new UnrecoverableError(response.data?.header?.resultMessage ?? 'NHN MMS send failed');
    }

    const body = response.data?.body?.data ?? response.data?.body ?? response.data;
    const requestId = body?.requestId ?? response.data?.requestId;
    const sendResult = body?.sendResultList?.[0] ?? response.data?.sendResultList?.[0];

    if (!requestId) {
      throw new UnrecoverableError('NHN MMS response did not include requestId');
    }

    const recipientSeq = sendResult?.recipientSeq ? String(sendResult.recipientSeq) : '1';

    return {
      messageId: `${requestId}:${recipientSeq}`,
      providerResponse: response.data,
      providerRequest: payload
    };
  }

  const payload = {
    body: request.renderedBody,
    sendNo: normalizePhoneNumber(request.senderPhoneNumber) || request.senderPhoneNumber,
    ...(request.scheduledAt ? { requestDate: formatNhnRequestDate(request.scheduledAt) } : {}),
    recipientList: [
      {
        recipientNo: request.recipientPhone
      }
    ]
  };

  const response = await axios.post(
    `${nhnSmsBaseUrl}/sms/v3.0/appKeys/${nhnSmsAppKey}/sender/sms`,
    payload,
    {
      timeout: 8000,
      headers: {
        'X-Secret-Key': nhnSmsSecretKey
      }
    }
  );

  if (response.data?.header?.isSuccessful === false) {
    throw new UnrecoverableError(response.data?.header?.resultMessage ?? 'NHN SMS send failed');
  }

  const body = response.data?.body?.data ?? response.data?.body ?? response.data;
  const requestId = body?.requestId ?? response.data?.requestId;
  const sendResult = body?.sendResultList?.[0] ?? response.data?.sendResultList?.[0];

  if (!requestId) {
    throw new UnrecoverableError('NHN SMS response did not include requestId');
  }

  const recipientSeq = sendResult?.recipientSeq ? String(sendResult.recipientSeq) : '1';

  return {
    messageId: `${requestId}:${recipientSeq}`,
    providerResponse: response.data,
    providerRequest: payload
  };
}

async function sendBulkSmsToNhn(request: {
  sendNo: string;
  body: string;
  recipients: Array<{
    recipientNo: string;
    recipientName?: string | null;
    recipientGroupingKey?: string | null;
    templateParameters?: Record<string, string>;
  }>;
}): Promise<{
  requestId: string;
  sendResultList: Array<{
    recipientNo: string;
    recipientSeq: string | null;
    resultCode: string | null;
    resultMessage: string | null;
    recipientGroupingKey: string | null;
  }>;
  providerRequest: unknown;
  providerResponse: unknown;
}> {
  const providerRequest = {
    body: request.body,
    sendNo: request.sendNo,
    recipientList: request.recipients.map((recipient) => ({
      recipientNo: recipient.recipientNo,
      ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
      ...(recipient.recipientGroupingKey ? { recipientGroupingKey: recipient.recipientGroupingKey } : {}),
      ...(recipient.templateParameters && Object.keys(recipient.templateParameters).length > 0
        ? { templateParameter: recipient.templateParameters }
        : {})
    }))
  };

  ensureSmsApiConfig();

  const response = await axios.post(
    `${nhnSmsBaseUrl}/sms/v3.0/appKeys/${nhnSmsAppKey}/sender/sms`,
    providerRequest,
    {
      timeout: 8000,
      headers: {
        'X-Secret-Key': nhnSmsSecretKey
      }
    }
  );

  if (response.data?.header?.isSuccessful === false) {
    throw new UnrecoverableError(response.data?.header?.resultMessage ?? 'NHN bulk SMS send failed');
  }

  const body = response.data?.body?.data ?? response.data?.body ?? response.data;
  const requestId = body?.requestId ?? response.data?.requestId;
  const rawResults = body?.sendResultList ?? response.data?.sendResultList ?? [];

  if (!requestId) {
    throw new UnrecoverableError('NHN bulk SMS response did not include requestId');
  }

  return {
    requestId: String(requestId),
    sendResultList: Array.isArray(rawResults)
      ? rawResults.map((item: Record<string, unknown>) => ({
          recipientNo: String(item.recipientNo ?? ''),
          recipientSeq: item.recipientSeq ? String(item.recipientSeq) : null,
          resultCode: item.resultCode !== undefined && item.resultCode !== null ? String(item.resultCode) : null,
          resultMessage: item.resultMessage ? String(item.resultMessage) : null,
          recipientGroupingKey: item.recipientGroupingKey ? String(item.recipientGroupingKey) : null
        }))
      : [],
    providerRequest,
    providerResponse: response.data
  };
}

async function sendBulkAlimtalkToNhn(request: {
  senderKey: string;
  templateCode: string;
  recipients: Array<{
    recipientNo: string;
    recipientName?: string | null;
    recipientGroupingKey?: string | null;
    templateParameters?: Record<string, string>;
  }>;
}): Promise<{
  requestId: string;
  sendResultList: Array<{
    recipientNo: string;
    recipientSeq: string | null;
    resultCode: string | null;
    resultMessage: string | null;
    recipientGroupingKey: string | null;
  }>;
  providerRequest: unknown;
  providerResponse: unknown;
}> {
  const providerRequest = {
    senderKey: request.senderKey,
    templateCode: request.templateCode,
    recipientList: request.recipients.map((recipient) => ({
      recipientNo: recipient.recipientNo,
      ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
      ...(recipient.recipientGroupingKey ? { recipientGroupingKey: recipient.recipientGroupingKey } : {}),
      ...(recipient.templateParameters && Object.keys(recipient.templateParameters).length > 0
        ? { templateParameter: recipient.templateParameters }
        : {})
    }))
  };

  ensureAlimtalkApiConfig();

  const response = await axios.post(
    `${nhnAlimtalkBaseUrl}/alimtalk/v2.3/appkeys/${nhnAlimtalkAppKey}/messages`,
    providerRequest,
    {
      timeout: 8000,
      headers: {
        'X-Secret-Key': nhnAlimtalkSecretKey,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    }
  );

  const immediateFailure = normalizeBizmessageSendFailure(response.data);
  if (immediateFailure) {
    throw new UnrecoverableError(immediateFailure);
  }

  const body = response.data?.message ?? response.data?.body ?? response.data;
  const requestId = body?.requestId ?? response.data?.requestId;
  const rawResults = body?.sendResults ?? body?.sendResultList ?? response.data?.sendResults ?? [];

  if (!requestId) {
    throw new UnrecoverableError('NHN bulk AlimTalk response did not include requestId');
  }

  return {
    requestId: String(requestId),
    sendResultList: Array.isArray(rawResults)
      ? rawResults.map((item: Record<string, unknown>) => ({
          recipientNo: String(item.recipientNo ?? ''),
          recipientSeq: item.recipientSeq ? String(item.recipientSeq) : null,
          resultCode: item.resultCode !== undefined && item.resultCode !== null ? String(item.resultCode) : null,
          resultMessage: item.resultMessage ? String(item.resultMessage) : null,
          recipientGroupingKey: item.recipientGroupingKey ? String(item.recipientGroupingKey) : null
        }))
      : [],
    providerRequest,
    providerResponse: response.data
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
    const smsFailoverConfig =
      metadata?.smsFailover && typeof metadata.smsFailover === 'object'
        ? (metadata.smsFailover as Record<string, unknown>)
        : null;
    const brandMessageConfig =
      metadata?.brandMessage && typeof metadata.brandMessage === 'object'
        ? (metadata.brandMessage as Record<string, unknown>)
        : null;
    const smsAdvertisementConfig =
      metadata?.smsAdvertisement && typeof metadata.smsAdvertisement === 'object'
        ? (metadata.smsAdvertisement as Record<string, unknown>)
        : null;
    const smsAttachments = parseStoredSmsAttachments(metadata?.smsAttachments);
    const mmsTitle = typeof metadata?.mmsTitle === 'string' ? metadata.mmsTitle : null;

    const isBrandTemplateMode =
      messageRequest.resolvedChannel === 'BRAND_MESSAGE' && brandMessageConfig?.mode === 'TEMPLATE';

    if (!directBody && !messageRequest.resolvedTemplate && !isBrandTemplateMode) {
      throw new UnrecoverableError('Resolved template is missing');
    }

    const variables = messageRequest.variablesJson as Record<string, string | number>;
    let renderedBody = directBody;
    if (!renderedBody && messageRequest.resolvedTemplate) {
      try {
        renderedBody = renderTemplate(messageRequest.resolvedTemplate!.body, variables);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Missing template variable:')) {
          throw new UnrecoverableError(error.message);
        }

        throw error;
      }
    }

    if (!renderedBody && isBrandTemplateMode) {
      const templateBody = typeof brandMessageConfig?.templateBody === 'string' ? brandMessageConfig.templateBody : '';
      if (templateBody) {
        try {
          renderedBody = renderTemplate(templateBody, variables);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Missing template variable:')) {
            throw new UnrecoverableError(error.message);
          }
          throw error;
        }
      } else {
        renderedBody = '';
      }
    }

    renderedBody = renderedBody ?? '';

    if (messageRequest.resolvedChannel === 'SMS') {
      renderedBody = formatSmsBody(renderedBody, {
        isAdvertisement: Boolean(smsAdvertisementConfig?.enabled),
        advertisingServiceName:
          typeof smsAdvertisementConfig?.advertisingServiceName === 'string'
            ? smsAdvertisementConfig.advertisingServiceName
            : null
      });
    }

    const smsMessageType =
      messageRequest.resolvedChannel === 'SMS'
        ? classifyDomesticSmsBody(renderedBody, {
            hasAttachments: smsAttachments.length > 0
          })
        : null;

    if (messageRequest.resolvedChannel === 'SMS' && smsMessageType === 'OVER_LIMIT') {
      throw new UnrecoverableError('SMS/LMS/MMS standard limit exceeded');
    }

    const smsFailover =
      typeof smsFailoverConfig?.senderNo === 'string'
        ? (() => {
            const failoverMessageType = classifyDomesticSmsBody(renderedBody);

            if (failoverMessageType === 'OVER_LIMIT') {
              throw new UnrecoverableError('SMS failover body exceeds LMS standard limit');
            }

            return {
              senderNo: smsFailoverConfig.senderNo,
              msgSms: renderedBody,
              smsKind: failoverMessageType === 'SMS' ? ('SMS' as const) : ('LMS' as const)
            };
          })()
        : null;

    if (messageRequest.resolvedChannel === 'ALIMTALK') {
      const isApprovedLocalTemplate = messageRequest.resolvedProviderTemplate?.providerStatus === 'APR';
      const isApprovedRemoteTemplate = manualAlimtalkTemplate?.providerStatus === 'APR';

      if (!isApprovedLocalTemplate && !isApprovedRemoteTemplate) {
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

    const brandMessage =
      messageRequest.resolvedChannel === 'BRAND_MESSAGE'
        ? {
            mode: brandMessageConfig?.mode === 'TEMPLATE' ? ('TEMPLATE' as const) : ('FREESTYLE' as const),
            targeting:
              brandMessageConfig?.targeting === 'M' || brandMessageConfig?.targeting === 'N'
                ? (brandMessageConfig.targeting as 'M' | 'N')
                : ('I' as const),
            messageType:
              typeof brandMessageConfig?.messageType === 'string'
                ? (brandMessageConfig.messageType as
                    | 'TEXT'
                    | 'IMAGE'
                    | 'WIDE'
                    | 'WIDE_ITEM_LIST'
                    | 'CAROUSEL_FEED'
                    | 'PREMIUM_VIDEO'
                    | 'COMMERCE'
                    | 'CAROUSEL_COMMERCE')
                : null,
            pushAlarm: brandMessageConfig?.pushAlarm !== false,
            adult: brandMessageConfig?.adult === true,
            statsId: typeof brandMessageConfig?.statsId === 'string' ? brandMessageConfig.statsId : null,
            resellerCode: typeof brandMessageConfig?.resellerCode === 'string' ? brandMessageConfig.resellerCode : null,
            templateCode:
              typeof brandMessageConfig?.templateCode === 'string' ? (brandMessageConfig.templateCode as string) : null,
            buttons: Array.isArray(brandMessageConfig?.buttons)
              ? (brandMessageConfig.buttons as Array<{
                  type: 'WL' | 'AL' | 'BK' | 'MD';
                  name: string;
                  linkMo?: string | null;
                  linkPc?: string | null;
                  schemeIos?: string | null;
                  schemeAndroid?: string | null;
                }>)
              : null,
            image:
              brandMessageConfig?.image && typeof brandMessageConfig.image === 'object'
                ? {
                    imageUrl:
                      typeof (brandMessageConfig.image as Record<string, unknown>).imageUrl === 'string'
                        ? ((brandMessageConfig.image as Record<string, unknown>).imageUrl as string)
                        : null,
                    imageLink:
                      typeof (brandMessageConfig.image as Record<string, unknown>).imageLink === 'string'
                        ? ((brandMessageConfig.image as Record<string, unknown>).imageLink as string)
                        : null
                  }
                : null
          }
        : null;

    if (messageRequest.resolvedChannel === 'BRAND_MESSAGE' && !brandMessageConfig) {
      throw new UnrecoverableError('Brand message metadata is missing');
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
      variables,
      scheduledAt: messageRequest.scheduledAt,
      smsMessageType: smsMessageType === 'SMS' || smsMessageType === 'LMS' || smsMessageType === 'MMS' ? smsMessageType : undefined,
      mmsTitle,
      attachments: smsAttachments,
      smsFailover,
      brandMessage
    });

    await prisma.messageAttempt.create({
      data: {
        messageRequestId: requestId,
        attemptNumber: messageRequest.attemptCount + 1,
        providerRequest: Prisma.JsonNull as never,
        providerResponse: Prisma.JsonNull as never
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
  } catch (error) {
    const retryable = isRetryable(error);
    const axiosError = error instanceof AxiosError ? error : null;

    await prisma.messageAttempt.create({
      data: {
        messageRequestId: requestId,
        attemptNumber: messageRequest.attemptCount + 1,
        providerRequest: Prisma.JsonNull as never,
        providerResponse: Prisma.JsonNull as never,
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

async function sendBulkBrandMessageToNhn(request: {
  senderKey: string;
  targeting: 'I' | 'M' | 'N';
  mode?: 'FREESTYLE' | 'TEMPLATE';
  messageType?:
    | 'TEXT'
    | 'IMAGE'
    | 'WIDE'
    | 'WIDE_ITEM_LIST'
    | 'CAROUSEL_FEED'
    | 'PREMIUM_VIDEO'
    | 'COMMERCE'
    | 'CAROUSEL_COMMERCE';
  content?: string;
  templateCode?: string | null;
  pushAlarm: boolean;
  adult: boolean;
  statsId?: string | null;
  resellerCode?: string | null;
  buttons?: Array<{
    type: 'WL' | 'AL' | 'BK' | 'MD';
    name: string;
    linkMo?: string | null;
    linkPc?: string | null;
    schemeIos?: string | null;
    schemeAndroid?: string | null;
  }> | null;
  image?: {
    imageUrl?: string | null;
    imageLink?: string | null;
  } | null;
  recipients: Array<{
    recipientNo: string;
    recipientName?: string | null;
    recipientGroupingKey?: string | null;
    templateParameters?: Record<string, string> | null;
  }>;
}) {
  ensureAlimtalkApiConfig();

  const mode = request.mode ?? 'FREESTYLE';
  const payload =
    mode === 'TEMPLATE'
      ? {
          senderKey: request.senderKey,
          templateCode: request.templateCode,
          pushAlarm: request.pushAlarm,
          adult: request.adult,
          ...(request.statsId ? { statsId: request.statsId } : {}),
          ...(request.resellerCode ? { resellerCode: request.resellerCode } : {}),
          recipientList: request.recipients.map((recipient) => ({
            recipientNo: recipient.recipientNo,
            ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
            ...(recipient.recipientGroupingKey ? { recipientGroupingKey: recipient.recipientGroupingKey } : {}),
            targeting: request.targeting,
            ...(recipient.templateParameters && Object.keys(recipient.templateParameters).length > 0
              ? { templateParameter: recipient.templateParameters }
              : {})
          }))
        }
      : {
          senderKey: request.senderKey,
          chatBubbleType: request.messageType,
          content: request.content,
          pushAlarm: request.pushAlarm,
          adult: request.adult,
          ...(request.statsId ? { statsId: request.statsId } : {}),
          ...(request.resellerCode ? { resellerCode: request.resellerCode } : {}),
          ...(request.buttons?.length ? { buttons: request.buttons } : {}),
          ...(request.image?.imageUrl
            ? {
                image: {
                  imageUrl: request.image.imageUrl,
                  imageLink: request.image.imageLink ?? null
                }
              }
            : {}),
          recipientList: request.recipients.map((recipient) => ({
            recipientNo: recipient.recipientNo,
            ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
            ...(recipient.recipientGroupingKey ? { recipientGroupingKey: recipient.recipientGroupingKey } : {}),
            targeting: request.targeting
          }))
        };

  const response = await axios.post(
    `${nhnAlimtalkBaseUrl}/brand-message/v1.0/appkeys/${nhnAlimtalkAppKey}/${mode === 'TEMPLATE' ? 'basic-messages' : 'freestyle-messages'}`,
    payload,
    {
      timeout: 8000,
      headers: {
        'X-Secret-Key': nhnAlimtalkSecretKey,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    }
  );

  const immediateFailure = normalizeBizmessageSendFailure(response.data);
  if (immediateFailure) {
    throw new UnrecoverableError(immediateFailure);
  }

  const body = response.data?.message ?? response.data?.body ?? response.data;
  const requestId = body?.requestId ?? response.data?.requestId;
  const rawResults = body?.sendResults ?? body?.sendResultList ?? response.data?.sendResults ?? [];

  if (!requestId) {
    throw new UnrecoverableError('NHN bulk brand message response did not include requestId');
  }

  return {
    requestId: String(requestId),
    sendResultList: Array.isArray(rawResults)
      ? rawResults.map((item: Record<string, unknown>) => ({
          recipientNo: String(item.recipientNo ?? ''),
          recipientSeq: item.recipientSeq ? String(item.recipientSeq) : null,
          resultCode: item.resultCode !== undefined && item.resultCode !== null ? String(item.resultCode) : null,
          resultMessage: item.resultMessage ? String(item.resultMessage) : null,
          recipientGroupingKey: item.recipientGroupingKey ? String(item.recipientGroupingKey) : null
        }))
      : [],
    providerRequest: payload,
    providerResponse: response.data
  };
}

async function processBulkSmsCampaign(job: Job<{ campaignId: string }>) {
  const campaignId = job.data.campaignId;
  const campaign = await prisma.bulkSmsCampaign.findUnique({
    where: { id: campaignId },
    include: {
      senderNumber: true,
      recipients: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!campaign) {
    return;
  }

  if (campaign.nhnRequestId || ['SENT_TO_PROVIDER', 'PARTIAL_FAILED', 'FAILED'].includes(campaign.status)) {
    return;
  }

  if (!campaign.senderNumber) {
    throw new UnrecoverableError('Bulk SMS sender number is missing');
  }

  if (campaign.recipients.length === 0) {
    throw new UnrecoverableError('Bulk SMS campaign has no recipients');
  }

  const recipients = campaign.recipients.map((recipient) => ({
    recipientNo: recipient.recipientPhone,
    recipientName: recipient.recipientName,
    recipientGroupingKey: recipient.recipientGroupingKey,
    templateParameters: parseTemplateParameters(recipient.templateParameters)
  }));
  const hasTemplateParameters = recipients.some(
    (recipient) => recipient.templateParameters && Object.keys(recipient.templateParameters).length > 0
  );
  const providerBody = hasTemplateParameters ? normalizeNhnTemplateBody(campaign.body) : campaign.body;

  try {
    const result = await sendBulkSmsToNhn({
      sendNo: normalizePhoneNumber(campaign.senderNumber.phoneNumber) || campaign.senderNumber.phoneNumber,
      body: providerBody,
      recipients
    });

    const updateTasks: Promise<unknown>[] = [];
    let hasAcceptedRecipient = false;
    let hasFailedRecipient = false;

    for (const item of result.sendResultList) {
      const isAccepted = item.resultCode === null || item.resultCode === '0';
      hasAcceptedRecipient ||= isAccepted;
      hasFailedRecipient ||= !isAccepted;

      if (item.recipientGroupingKey) {
        updateTasks.push(
          prisma.bulkSmsRecipient.updateMany({
            where: {
              campaignId,
              recipientGroupingKey: item.recipientGroupingKey
            },
            data: isAccepted
              ? {
                  recipientSeq: item.recipientSeq
                }
              : {
                  recipientSeq: item.recipientSeq,
                  status: 'FAILED'
                }
          })
        );
      }
    }

    await Promise.all(updateTasks);

    await prisma.bulkSmsCampaign.update({
      where: { id: campaignId },
      data: {
        status:
          hasAcceptedRecipient && !hasFailedRecipient
            ? 'SENT_TO_PROVIDER'
            : hasAcceptedRecipient
              ? 'PARTIAL_FAILED'
              : 'FAILED',
        nhnRequestId: result.requestId,
        providerRequest: Prisma.JsonNull as never,
        providerResponse: Prisma.JsonNull as never
      }
    });
  } catch (error) {
    if (!isRetryable(error)) {
      throw new UnrecoverableError(error instanceof Error ? error.message : 'Unrecoverable');
    }

    throw error;
  }
}

async function processBulkAlimtalkCampaign(job: Job<{ campaignId: string }>) {
  const campaignId = job.data.campaignId;
  const campaign = await prisma.bulkAlimtalkCampaign.findUnique({
    where: { id: campaignId },
    include: {
      senderProfile: true,
      recipients: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!campaign) {
    return;
  }

  if (campaign.nhnRequestId || ['SENT_TO_PROVIDER', 'PARTIAL_FAILED', 'FAILED'].includes(campaign.status)) {
    return;
  }

  if (!campaign.senderProfile?.senderKey) {
    throw new UnrecoverableError('Bulk AlimTalk sender profile is missing');
  }

  if (!campaign.templateCode) {
    throw new UnrecoverableError('Bulk AlimTalk templateCode is missing');
  }

  if (campaign.recipients.length === 0) {
    throw new UnrecoverableError('Bulk AlimTalk campaign has no recipients');
  }

  const recipients = campaign.recipients.map((recipient) => {
    const templateParameters = parseTemplateParameters(recipient.templateParameters);
    const hasTemplateParameterObject =
      Boolean(recipient.templateParameters) &&
      !Array.isArray(recipient.templateParameters) &&
      typeof recipient.templateParameters === 'object';

    if (!templateParameters && !hasTemplateParameterObject) {
      throw new UnrecoverableError(`Template parameters are missing for recipient ${recipient.id}`);
    }

    return {
      recipientNo: recipient.recipientPhone,
      recipientName: recipient.recipientName,
      recipientGroupingKey: recipient.recipientGroupingKey,
      ...(templateParameters ? { templateParameters } : {})
    };
  });

  try {
    const result = await sendBulkAlimtalkToNhn({
      senderKey: campaign.senderProfile.senderKey,
      templateCode: campaign.templateCode,
      recipients
    });

    const updateTasks: Promise<unknown>[] = [];
    let hasAcceptedRecipient = false;
    let hasFailedRecipient = false;

    for (const item of result.sendResultList) {
      const isAccepted = item.resultCode === null || item.resultCode === '0';
      hasAcceptedRecipient ||= isAccepted;
      hasFailedRecipient ||= !isAccepted;

      if (item.recipientGroupingKey) {
        updateTasks.push(
          prisma.bulkAlimtalkRecipient.updateMany({
            where: {
              campaignId,
              recipientGroupingKey: item.recipientGroupingKey
            },
            data: isAccepted
              ? {
                  recipientSeq: item.recipientSeq
                }
              : {
                  recipientSeq: item.recipientSeq,
                  status: 'FAILED'
                }
          })
        );
      }
    }

    await Promise.all(updateTasks);

    await prisma.bulkAlimtalkCampaign.update({
      where: { id: campaignId },
      data: {
        status:
          hasAcceptedRecipient && !hasFailedRecipient
            ? 'SENT_TO_PROVIDER'
            : hasAcceptedRecipient
              ? 'PARTIAL_FAILED'
              : 'FAILED',
        nhnRequestId: result.requestId,
        providerRequest: Prisma.JsonNull as never,
        providerResponse: Prisma.JsonNull as never
      }
    });
  } catch (error) {
    if (!isRetryable(error)) {
      throw new UnrecoverableError(error instanceof Error ? error.message : 'Unrecoverable');
    }

    throw error;
  }
}

async function processBulkBrandMessageCampaign(job: Job<{ campaignId: string }>) {
  const campaignId = job.data.campaignId;
  const campaign = await prisma.bulkBrandMessageCampaign.findUnique({
    where: { id: campaignId },
    include: {
      senderProfile: true,
      recipients: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!campaign) {
    return;
  }

  if (campaign.nhnRequestId || ['SENT_TO_PROVIDER', 'PARTIAL_FAILED', 'FAILED'].includes(campaign.status)) {
    return;
  }

  if (!campaign.senderProfile?.senderKey) {
    throw new UnrecoverableError('Bulk brand message sender profile is missing');
  }

  if (campaign.recipients.length === 0) {
    throw new UnrecoverableError('Bulk brand message campaign has no recipients');
  }

  try {
    const result = await sendBulkBrandMessageToNhn({
      senderKey: campaign.senderProfile.senderKey,
      mode: campaign.mode as 'FREESTYLE' | 'TEMPLATE',
      targeting: 'I',
      messageType: campaign.messageType as
        | 'TEXT'
        | 'IMAGE'
        | 'WIDE'
        | 'WIDE_ITEM_LIST'
        | 'CAROUSEL_FEED'
        | 'PREMIUM_VIDEO'
        | 'COMMERCE'
        | 'CAROUSEL_COMMERCE',
      content: campaign.mode === 'FREESTYLE' ? campaign.body : undefined,
      templateCode: campaign.templateCode,
      pushAlarm: campaign.pushAlarm,
      adult: campaign.adult,
      statsId: campaign.statsEventKey,
      resellerCode: campaign.resellerCode,
      buttons: Array.isArray(campaign.buttonsJson) ? (campaign.buttonsJson as any) : [],
      image:
        campaign.imageUrl || campaign.imageLink
          ? {
              imageUrl: campaign.imageUrl,
              imageLink: campaign.imageLink
            }
          : null,
      recipients: campaign.recipients.map((recipient) => ({
        recipientNo: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientGroupingKey: recipient.recipientGroupingKey,
        templateParameters:
          recipient.templateParameters && typeof recipient.templateParameters === 'object' && !Array.isArray(recipient.templateParameters)
            ? (recipient.templateParameters as Record<string, string>)
            : undefined
      }))
    });

    const updateTasks: Promise<unknown>[] = [];
    let hasAcceptedRecipient = false;
    let hasFailedRecipient = false;

    for (const item of result.sendResultList) {
      const isAccepted = item.resultCode === null || item.resultCode === '0';
      hasAcceptedRecipient ||= isAccepted;
      hasFailedRecipient ||= !isAccepted;

      if (item.recipientGroupingKey) {
        updateTasks.push(
          prisma.bulkBrandMessageRecipient.updateMany({
            where: {
              campaignId,
              recipientGroupingKey: item.recipientGroupingKey
            },
            data: isAccepted
              ? {
                  recipientSeq: item.recipientSeq
                }
              : {
                  recipientSeq: item.recipientSeq,
                  status: 'FAILED'
                }
          })
        );
      }
    }

    await Promise.all(updateTasks);

    await prisma.bulkBrandMessageCampaign.update({
      where: { id: campaignId },
      data: {
        status:
          hasAcceptedRecipient && !hasFailedRecipient
            ? 'SENT_TO_PROVIDER'
            : hasAcceptedRecipient
              ? 'PARTIAL_FAILED'
              : 'FAILED',
        nhnRequestId: result.requestId,
        providerRequest: Prisma.JsonNull as never,
        providerResponse: Prisma.JsonNull as never
      }
    });
  } catch (error) {
    if (!isRetryable(error)) {
      throw new UnrecoverableError(error instanceof Error ? error.message : 'Unrecoverable');
    }

    throw error;
  }
}

type WorkerJobData = { requestId: string } | { campaignId: string };

async function processQueueJob(job: Job<WorkerJobData>) {
  if (job.name === MESSAGE_JOB_NAME) {
    await processMessage(job as Job<{ requestId: string }>);
    return;
  }

  if (job.name === BULK_SMS_JOB_NAME) {
    await processBulkSmsCampaign(job as Job<{ campaignId: string }>);
    return;
  }

  if (job.name === BULK_ALIMTALK_JOB_NAME) {
    await processBulkAlimtalkCampaign(job as Job<{ campaignId: string }>);
    return;
  }

  if (job.name === BULK_BRAND_MESSAGE_JOB_NAME) {
    await processBulkBrandMessageCampaign(job as Job<{ campaignId: string }>);
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
const worker = new Worker<WorkerJobData>(queueName, processQueueJob, {
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
  console.log(`[worker] processing ${job.id} (${job.name})`);
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
    if (job.name === MESSAGE_JOB_NAME) {
      const requestId = String((job.data as { requestId: string }).requestId);

      await prisma.messageRequest.updateMany({
        where: {
          id: requestId,
          status: {
            notIn: ['SEND_FAILED', 'DELIVERY_FAILED', 'DELIVERED', 'CANCELED', 'DEAD']
          }
        },
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
      return;
    }

    if (job.name === BULK_SMS_JOB_NAME) {
      const campaignId = String((job.data as { campaignId: string }).campaignId);
      await prisma.bulkSmsCampaign.updateMany({
        where: {
          id: campaignId,
          status: {
            notIn: ['SENT_TO_PROVIDER', 'PARTIAL_FAILED', 'FAILED']
          }
        },
        data: {
          status: 'FAILED',
          providerResponse: {
            error: error.message
          } as never
        }
      });
      return;
    }

    if (job.name === BULK_ALIMTALK_JOB_NAME) {
      const campaignId = String((job.data as { campaignId: string }).campaignId);
      await prisma.bulkAlimtalkCampaign.updateMany({
        where: {
          id: campaignId,
          status: {
            notIn: ['SENT_TO_PROVIDER', 'PARTIAL_FAILED', 'FAILED']
          }
        },
        data: {
          status: 'FAILED',
          providerResponse: {
            error: error.message
          } as never
        }
      });
      return;
    }

    if (job.name === BULK_BRAND_MESSAGE_JOB_NAME) {
      const campaignId = String((job.data as { campaignId: string }).campaignId);
      await prisma.bulkBrandMessageCampaign.updateMany({
        where: {
          id: campaignId,
          status: {
            notIn: ['SENT_TO_PROVIDER', 'PARTIAL_FAILED', 'FAILED']
          }
        },
        data: {
          status: 'FAILED',
          providerResponse: {
            error: error.message
          } as never
        }
      });
    }
  }
});

process.on('SIGINT', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[worker] started');
