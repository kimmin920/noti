import { MessageChannel } from '@prisma/client';
import { ProviderResultsService } from '../src/provider-results/provider-results.service';

describe('ProviderResultsService', () => {
  it('returns WAITING for scheduled local requests without NHN ids', async () => {
    const service = new ProviderResultsService({} as any);

    const result = await service.resolveMessageRequest({
      status: 'ACCEPTED',
      nhnMessageId: null,
      resolvedChannel: MessageChannel.BRAND_MESSAGE,
      metadataJson: null,
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: new Date('2026-04-07T12:00:00.000Z')
    });

    expect(result.status).toBe('WAITING');
  });

  it('returns LOOKUP_FAILED when provider lookup fails for immediate requests', async () => {
    const nhnService = {
      fetchBrandMessageDeliveryStatus: jest.fn(async () => {
        throw new Error('lookup failed');
      })
    };
    const service = new ProviderResultsService(nhnService as any);

    const result = await service.resolveMessageRequest({
      status: 'PROCESSING',
      nhnMessageId: 'nhn_message_1',
      resolvedChannel: MessageChannel.BRAND_MESSAGE,
      metadataJson: null,
      scheduledAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: new Date('2026-04-07T12:00:00.000Z')
    });

    expect(result.status).toBe('LOOKUP_FAILED');
    expect(result.latestDeliveryResult).toEqual(
      expect.objectContaining({
        providerStatus: 'LOOKUP_ERROR',
        providerCode: 'NHN_LOOKUP_ERROR'
      })
    );
  });

  it('maps korean success statuses and sms provider code 1000 to DELIVERED', async () => {
    const nhnService = {
      fetchSmsDeliveryStatus: jest.fn(async () => ({
        requestId: 'request_1',
        recipientSeq: '1',
        recipientNo: '01012345678',
        providerStatus: '성공',
        providerCode: '1000',
        providerMessage: '성공',
        requestedAt: '2026-04-07T12:00:00.000Z',
        resultAt: '2026-04-07T12:00:10.000Z',
        payload: {}
      }))
    };
    const service = new ProviderResultsService(nhnService as any);

    const result = await service.resolveMessageRequest({
      status: 'PROCESSING',
      nhnMessageId: 'request_1:1',
      resolvedChannel: MessageChannel.SMS,
      metadataJson: { smsMessageType: 'MMS' },
      scheduledAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: new Date('2026-04-07T12:00:30.000Z')
    });

    expect(result.status).toBe('DELIVERED');
    expect(result.latestDeliveryResult).toEqual(
      expect.objectContaining({
        providerStatus: '성공',
        providerCode: '1000',
        providerMessage: '성공'
      })
    );
  });

  it('returns WAITING for scheduled bulk campaigns before NHN request id is issued', async () => {
    const service = new ProviderResultsService({} as any);

    const result = await service.resolveBrandMessageCampaign({
      status: 'ACCEPTED',
      totalRecipientCount: 3,
      skippedNoPhoneCount: 0,
      duplicatePhoneCount: 0,
      nhnRequestId: null,
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
      recipients: [
        {
          id: 'recipient_1',
          recipientPhone: '01012345678',
          recipientSeq: null,
          status: 'REQUESTED'
        }
      ]
    });

    expect(result.status).toBe('WAITING');
    expect(result.recipientStats.pendingCount).toBe(3);
  });

  it('returns FAILED for bulk campaigns that never received a provider request id', async () => {
    const service = new ProviderResultsService({} as any);

    const result = await service.resolveAlimtalkCampaign({
      status: 'FAILED',
      totalRecipientCount: 1,
      skippedNoPhoneCount: 0,
      duplicatePhoneCount: 0,
      nhnRequestId: null,
      scheduledAt: null,
      providerResponse: {
        error: 'Template parameters are missing for recipient recipient_1'
      },
      recipients: [
        {
          id: 'recipient_1',
          recipientPhone: '01012345678',
          recipientSeq: null,
          status: 'REQUESTED'
        }
      ]
    });

    expect(result.status).toBe('FAILED');
    expect(result.recipientStats.failedCount).toBe(1);
    expect(result.recipientStats.pendingCount).toBe(0);
    expect(result.recipients.get('recipient_1')).toEqual(
      expect.objectContaining({
        status: 'SEND_FAILED',
        providerResultCode: 'SUBMIT_FAILED',
        providerResultMessage: '템플릿 변수 값이 비어 있어 발송하지 못했습니다.'
      })
    );
  });

  it('falls back to per-recipient AlimTalk lookups when bulk lookup returns no rows', async () => {
    const nhnService = {
      fetchBulkAlimtalkDeliveryStatuses: jest.fn(async () => []),
      fetchAlimtalkDeliveryStatus: jest.fn(async () => ({
        requestId: 'request_1',
        recipientSeq: '1',
        recipientNo: '01012345678',
        providerStatus: 'COMPLETED',
        providerCode: '1000',
        providerMessage: '성공',
        requestedAt: '2026-04-07T12:00:00.000Z',
        resultAt: '2026-04-07T12:00:10.000Z',
        payload: {}
      }))
    };
    const service = new ProviderResultsService(nhnService as any);

    const result = await service.resolveAlimtalkCampaign({
      status: 'SENT_TO_PROVIDER',
      totalRecipientCount: 1,
      skippedNoPhoneCount: 0,
      duplicatePhoneCount: 0,
      nhnRequestId: 'request_1',
      scheduledAt: null,
      recipients: [
        {
          id: 'recipient_1',
          recipientPhone: '01012345678',
          recipientSeq: '1',
          status: 'REQUESTED'
        }
      ]
    });

    expect(nhnService.fetchBulkAlimtalkDeliveryStatuses).toHaveBeenCalledWith('request_1');
    expect(nhnService.fetchAlimtalkDeliveryStatus).toHaveBeenCalledWith('request_1:1');
    expect(result.status).toBe('DELIVERED');
    expect(result.recipientStats.deliveredCount).toBe(1);
    expect(result.recipientStats.pendingCount).toBe(0);
    expect(result.recipients.get('recipient_1')).toEqual(
      expect.objectContaining({
        status: 'DELIVERED',
        providerResultCode: '1000',
        providerResultMessage: '성공'
      })
    );
  });
});
