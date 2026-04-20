import { Injectable } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { NhnRecipientDeliveryLookup, NhnService } from '../nhn/nhn.service';

export type ProviderResolvedStatus =
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'LOOKUP_FAILED'
  | 'SENT_TO_PROVIDER'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'SEND_FAILED'
  | 'CANCELED'
  | 'DEAD';

export type ProviderResolvedDeliveryResult = {
  providerStatus: string;
  providerCode: string | null;
  providerMessage: string | null;
  createdAt: string;
};

export type ProviderResolvedMessageRequest = {
  status: ProviderResolvedStatus;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  latestDeliveryResult: ProviderResolvedDeliveryResult | null;
  deliveryResults: ProviderResolvedDeliveryResult[];
};

export type ProviderResolvedRecipient = {
  status: ProviderResolvedStatus | 'REQUESTED';
  providerResultCode: string | null;
  providerResultMessage: string | null;
  providerStatus: string | null;
  resolvedAt: string | null;
};

export type ProviderResolvedCampaignStats = {
  totalCount: number;
  submittedCount: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  skippedNoPhoneCount: number;
  duplicatePhoneCount: number;
};

export type ProviderResolvedCampaign = {
  status: string;
  recipientStats: ProviderResolvedCampaignStats;
  recipients: Map<string, ProviderResolvedRecipient>;
};

@Injectable()
export class ProviderResultsService {
  constructor(private readonly nhnService: NhnService) {}

  async resolveMessageRequests<T extends MessageRequestLookupShape>(requests: T[]) {
    return Promise.all(requests.map((request) => this.resolveMessageRequest(request)));
  }

  async resolveMessageRequest(request: MessageRequestLookupShape): Promise<ProviderResolvedMessageRequest> {
    if (!request.nhnMessageId || !request.resolvedChannel) {
      return {
        status: normalizeLocalMessageStatus(request.status, request.scheduledAt),
        lastErrorCode: request.lastErrorCode,
        lastErrorMessage: request.lastErrorMessage,
        latestDeliveryResult: null,
        deliveryResults: []
      };
    }

    try {
      const lookup = await this.fetchSingleLookup(request);
      const status = mapLookupToStatus(lookup, request.scheduledAt);
      const latest = toDeliveryResult(lookup, request.updatedAt.toISOString());

      return {
        status,
        lastErrorCode: isFailureStatus(status) ? latest.providerCode : null,
        lastErrorMessage: isFailureStatus(status) ? latest.providerMessage : null,
        latestDeliveryResult: latest,
        deliveryResults: [latest]
      };
    } catch (error) {
      return {
        status: normalizeLookupFailureStatus(request.status, request.scheduledAt),
        lastErrorCode: request.lastErrorCode,
        lastErrorMessage: request.lastErrorMessage,
        latestDeliveryResult: {
          providerStatus: 'LOOKUP_ERROR',
          providerCode: 'NHN_LOOKUP_ERROR',
          providerMessage: error instanceof Error ? error.message : 'NHN 조회에 실패했습니다.',
          createdAt: request.updatedAt.toISOString()
        },
        deliveryResults: [
          {
            providerStatus: 'LOOKUP_ERROR',
            providerCode: 'NHN_LOOKUP_ERROR',
            providerMessage: error instanceof Error ? error.message : 'NHN 조회에 실패했습니다.',
            createdAt: request.updatedAt.toISOString()
          }
        ]
      };
    }
  }

  async resolveSmsCampaign(campaign: BulkCampaignLookupShape) {
    return this.resolveBulkCampaign(campaign, async () => {
      if (!campaign.nhnRequestId) {
        return [];
      }
      return this.nhnService.fetchBulkSmsDeliveryStatuses(campaign.nhnRequestId);
    });
  }

  async resolveAlimtalkCampaign(campaign: BulkCampaignLookupShape) {
    return this.resolveBulkCampaign(campaign, async () => {
      if (!campaign.nhnRequestId) {
        return [];
      }
      return this.nhnService.fetchBulkAlimtalkDeliveryStatuses(campaign.nhnRequestId);
    }, async (recipient) => {
      if (!campaign.nhnRequestId || !recipient.recipientSeq) {
        return null;
      }

      return this.nhnService.fetchAlimtalkDeliveryStatus(`${campaign.nhnRequestId}:${recipient.recipientSeq}`);
    });
  }

  async resolveBrandMessageCampaign(campaign: BulkCampaignLookupShape) {
    return this.resolveBulkCampaign(campaign, async () => {
      if (!campaign.nhnRequestId) {
        return [];
      }
      return this.nhnService.fetchBulkBrandMessageDeliveryStatuses(campaign.nhnRequestId);
    }, async (recipient) => {
      if (!campaign.nhnRequestId || !recipient.recipientSeq) {
        return null;
      }

      return this.nhnService.fetchBrandMessageDeliveryStatus(`${campaign.nhnRequestId}:${recipient.recipientSeq}`);
    });
  }

  private async fetchSingleLookup(request: MessageRequestLookupShape) {
    if (request.resolvedChannel === MessageChannel.ALIMTALK) {
      return this.nhnService.fetchAlimtalkDeliveryStatus(request.nhnMessageId!);
    }

    if (request.resolvedChannel === MessageChannel.BRAND_MESSAGE) {
      return this.nhnService.fetchBrandMessageDeliveryStatus(request.nhnMessageId!);
    }

    const metadata =
      request.metadataJson && typeof request.metadataJson === 'object'
        ? (request.metadataJson as Record<string, unknown>)
        : null;
    const smsMessageType = metadata?.smsMessageType === 'MMS' ? 'MMS' : 'SMS';
    return this.nhnService.fetchSmsDeliveryStatus(request.nhnMessageId!, smsMessageType);
  }

  private async resolveBulkCampaign(
    campaign: BulkCampaignLookupShape,
    fetcher: () => Promise<NhnRecipientDeliveryLookup[]>,
    fallbackFetcher?: (
      recipient: BulkCampaignLookupShape['recipients'][number]
    ) => Promise<NhnRecipientDeliveryLookup | null>
  ): Promise<ProviderResolvedCampaign> {
    if (!campaign.nhnRequestId) {
      const locallyFailed = campaign.status === 'FAILED' || campaign.status === 'PARTIAL_FAILED';
      const localFailure = locallyFailed ? extractLocalBulkFailure(campaign.providerResponse) : null;
      const recipients = new Map<string, ProviderResolvedRecipient>();

      if (locallyFailed) {
        for (const recipient of campaign.recipients) {
          recipients.set(recipient.id, {
            status: 'SEND_FAILED',
            providerResultCode: localFailure?.code ?? null,
            providerResultMessage: localFailure?.message ?? null,
            providerStatus: localFailure?.status ?? 'SUBMIT_FAILED',
            resolvedAt: null
          });
        }
      }

      return {
        status: locallyFailed
          ? campaign.status
          : campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now()
            ? 'WAITING'
            : 'IN_PROGRESS',
        recipientStats: buildCampaignStats({
          totalCount: campaign.totalRecipientCount,
          submittedCount: 0,
          deliveredCount: 0,
          failedCount: locallyFailed ? campaign.totalRecipientCount : 0,
          pendingCount: locallyFailed ? 0 : campaign.totalRecipientCount,
          skippedNoPhoneCount: campaign.skippedNoPhoneCount,
          duplicatePhoneCount: campaign.duplicatePhoneCount
        }),
        recipients
      };
    }

    try {
      let lookups = await fetcher();
      if (lookups.length === 0 && fallbackFetcher) {
        const fallbackLookups = await Promise.all(campaign.recipients.map((recipient) => fallbackFetcher(recipient)));
        lookups = fallbackLookups.filter((item): item is NhnRecipientDeliveryLookup => Boolean(item));
      }
      const bySeq = new Map<string, NhnRecipientDeliveryLookup>();
      const byPhone = new Map<string, NhnRecipientDeliveryLookup>();

      for (const lookup of lookups) {
        if (lookup.recipientSeq) {
          bySeq.set(String(lookup.recipientSeq), lookup);
        }
        if (lookup.recipientNo) {
          byPhone.set(normalizePhone(lookup.recipientNo), lookup);
        }
      }

      const recipients = new Map<string, ProviderResolvedRecipient>();
      let submittedCount = 0;
      let deliveredCount = 0;
      let failedCount = 0;
      let pendingCount = 0;

      for (const recipient of campaign.recipients) {
        const lookup =
          (recipient.recipientSeq ? bySeq.get(String(recipient.recipientSeq)) : null) ||
          byPhone.get(normalizePhone(recipient.recipientPhone)) ||
          null;

        if (!lookup) {
          pendingCount += 1;
          recipients.set(recipient.id, {
            status:
              recipient.status === 'FAILED'
                ? 'DELIVERY_FAILED'
                : campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now()
                  ? 'WAITING'
                  : 'REQUESTED',
            providerResultCode: null,
            providerResultMessage: null,
            providerStatus: null,
            resolvedAt: null
          });
          continue;
        }

        const status = mapLookupToStatus(lookup, campaign.scheduledAt);
        if (status === 'DELIVERED') {
          deliveredCount += 1;
        } else if (isFailureStatus(status)) {
          failedCount += 1;
        } else if (status === 'SENT_TO_PROVIDER') {
          submittedCount += 1;
        } else {
          pendingCount += 1;
        }

        recipients.set(recipient.id, {
          status,
          providerResultCode: lookup.providerCode,
          providerResultMessage: lookup.providerMessage,
          providerStatus: lookup.providerStatus,
          resolvedAt: lookup.resultAt || lookup.requestedAt
        });
      }

      return {
        status: deriveCampaignStatus({
          totalCount: campaign.totalRecipientCount,
          submittedCount,
          deliveredCount,
          failedCount,
          pendingCount
        }),
        recipientStats: buildCampaignStats({
          totalCount: campaign.totalRecipientCount,
          submittedCount,
          deliveredCount,
          failedCount,
          pendingCount,
          skippedNoPhoneCount: campaign.skippedNoPhoneCount,
          duplicatePhoneCount: campaign.duplicatePhoneCount
        }),
        recipients
      };
    } catch {
      return {
        status: campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now() ? 'WAITING' : 'LOOKUP_FAILED',
        recipientStats: buildCampaignStats({
          totalCount: campaign.totalRecipientCount,
          submittedCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          pendingCount: campaign.totalRecipientCount,
          skippedNoPhoneCount: campaign.skippedNoPhoneCount,
          duplicatePhoneCount: campaign.duplicatePhoneCount
        }),
        recipients: new Map()
      };
    }
  }
}

export type MessageRequestLookupShape = {
  status: string;
  nhnMessageId: string | null;
  resolvedChannel: MessageChannel | null;
  metadataJson: unknown;
  scheduledAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: Date;
};

export type BulkCampaignLookupShape = {
  status: string;
  totalRecipientCount: number;
  skippedNoPhoneCount: number;
  duplicatePhoneCount: number;
  nhnRequestId: string | null;
  scheduledAt: Date | null;
  providerResponse?: unknown;
  recipients: Array<{
    id: string;
    recipientPhone: string;
    recipientSeq: string | number | null;
    status: string;
  }>;
};

function toDeliveryResult(lookup: NhnRecipientDeliveryLookup, fallbackDate: string): ProviderResolvedDeliveryResult {
  return {
    providerStatus: lookup.providerStatus || 'PENDING',
    providerCode: lookup.providerCode,
    providerMessage: lookup.providerMessage,
    createdAt: lookup.resultAt || lookup.requestedAt || fallbackDate
  };
}

function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeLocalMessageStatus(status: string, scheduledAt: Date | null): ProviderResolvedStatus {
  if ((status === 'ACCEPTED' || status === 'PROCESSING') && scheduledAt && scheduledAt.getTime() > Date.now()) {
    return 'WAITING';
  }

  if (status === 'ACCEPTED' || status === 'PROCESSING') {
    return 'IN_PROGRESS';
  }

  return normalizeKnownStatus(status);
}

function normalizeLookupFailureStatus(status: string, scheduledAt: Date | null): ProviderResolvedStatus {
  if (
    status === 'DELIVERED' ||
    status === 'DELIVERY_FAILED' ||
    status === 'SEND_FAILED' ||
    status === 'DEAD' ||
    status === 'CANCELED'
  ) {
    return normalizeKnownStatus(status);
  }

  return scheduledAt && scheduledAt.getTime() > Date.now() ? 'WAITING' : 'LOOKUP_FAILED';
}

function normalizeKnownStatus(status: string): ProviderResolvedStatus {
  switch (status) {
    case 'WAITING':
    case 'IN_PROGRESS':
    case 'LOOKUP_FAILED':
    case 'SENT_TO_PROVIDER':
    case 'DELIVERED':
    case 'DELIVERY_FAILED':
    case 'SEND_FAILED':
    case 'CANCELED':
    case 'DEAD':
      return status;
    case 'ACCEPTED':
      return 'WAITING';
    case 'PROCESSING':
      return 'IN_PROGRESS';
    default:
      return 'IN_PROGRESS';
  }
}

function extractLocalBulkFailure(providerResponse: unknown): {
  status: string;
  code: string | null;
  message: string | null;
} | null {
  const record =
    providerResponse && typeof providerResponse === 'object'
      ? (providerResponse as Record<string, unknown>)
      : null;
  const header =
    record?.header && typeof record.header === 'object'
      ? (record.header as Record<string, unknown>)
      : null;

  const rawCode =
    header?.resultCode !== undefined && header?.resultCode !== null && header?.resultCode !== ''
      ? String(header.resultCode)
      : null;
  const rawMessage = [
    typeof record?.error === 'string' ? record.error : null,
    typeof record?.message === 'string' ? record.message : null,
    typeof record?.title === 'string' ? record.title : null,
    typeof header?.resultMessage === 'string' ? header.resultMessage : null
  ].find((value): value is string => Boolean(value && value.trim()));

  if (!rawCode && !rawMessage) {
    return null;
  }

  return {
    status: 'SUBMIT_FAILED',
    code: rawCode ?? 'SUBMIT_FAILED',
    message: sanitizeLocalBulkFailureMessage(rawMessage ?? '발송 요청 처리 중 오류가 발생했습니다.')
  };
}

function sanitizeLocalBulkFailureMessage(message: string) {
  const normalized = String(message || '').trim();

  if (!normalized) {
    return '발송 요청 처리 중 오류가 발생했습니다.';
  }

  if (/template parameters are missing/i.test(normalized)) {
    return '템플릿 변수 값이 비어 있어 발송하지 못했습니다.';
  }

  return normalized.replace(/\s+for recipient\s+\S+/i, '').trim();
}

function mapLookupToStatus(lookup: NhnRecipientDeliveryLookup, scheduledAt: Date | null): ProviderResolvedStatus {
  const upperStatus = String(lookup.providerStatus || '').toUpperCase();
  const upperMessage = String(lookup.providerMessage || '').toUpperCase();
  const providerCode = String(lookup.providerCode || '').toUpperCase();

  if (
    upperStatus.includes('FAIL') ||
    upperStatus.includes('실패') ||
    upperStatus.includes('REJECT') ||
    upperStatus.includes('거부') ||
    upperStatus.includes('CANCEL') ||
    upperStatus.includes('취소') ||
    upperMessage.includes('FAIL') ||
    upperMessage.includes('실패') ||
    upperMessage.includes('REJECT') ||
    upperMessage.includes('거부') ||
    upperMessage.includes('CANCEL') ||
    upperMessage.includes('취소') ||
    providerCode === 'MRC02' ||
    providerCode === 'MRC03' ||
    providerCode === 'MRC04'
  ) {
    return 'DELIVERY_FAILED';
  }

  if (
    upperStatus.includes('DELIVER') ||
    upperStatus.includes('SUCCESS') ||
    upperStatus.includes('성공') ||
    upperStatus.includes('COMPLETE') ||
    upperStatus.includes('DONE') ||
    upperMessage.includes('SUCCESS') ||
    upperMessage.includes('성공') ||
    providerCode === '0' ||
    providerCode === '0000' ||
    providerCode === '1000' ||
    providerCode === 'MRC01'
  ) {
    return 'DELIVERED';
  }

  if (
    upperStatus.includes('SENT') ||
    upperStatus.includes('ACCEPT') ||
    upperStatus.includes('접수') ||
    upperStatus.includes('REQUEST') ||
    upperStatus.includes('요청') ||
    upperStatus.includes('SUBMIT')
  ) {
    return 'SENT_TO_PROVIDER';
  }

  if (
    upperStatus.includes('PROCESS') ||
    upperStatus.includes('처리') ||
    upperStatus.includes('WAIT') ||
    upperStatus.includes('대기') ||
    upperStatus.includes('PENDING') ||
    upperStatus.includes('READY') ||
    upperStatus.includes('준비')
  ) {
    return scheduledAt && scheduledAt.getTime() > Date.now() ? 'WAITING' : 'IN_PROGRESS';
  }

  return scheduledAt && scheduledAt.getTime() > Date.now() ? 'WAITING' : 'IN_PROGRESS';
}

function deriveCampaignStatus(stats: {
  totalCount: number;
  submittedCount: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
}) {
  if (stats.totalCount <= 0) {
    return 'IN_PROGRESS';
  }

  if (stats.failedCount >= stats.totalCount) {
    return 'FAILED';
  }

  if (stats.deliveredCount >= stats.totalCount) {
    return 'DELIVERED';
  }

  if (stats.failedCount > 0) {
    return 'PARTIAL_FAILED';
  }

  if (stats.submittedCount > 0) {
    return 'SENT_TO_PROVIDER';
  }

  if (stats.pendingCount > 0) {
    return 'IN_PROGRESS';
  }

  return 'IN_PROGRESS';
}

function buildCampaignStats(stats: ProviderResolvedCampaignStats): ProviderResolvedCampaignStats {
  return stats;
}

function isFailureStatus(status: string) {
  return status === 'DELIVERY_FAILED' || status === 'SEND_FAILED' || status === 'DEAD';
}
