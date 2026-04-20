import { ConflictException } from '@nestjs/common';
import { SenderNumbersService } from '../src/sender-numbers/sender-numbers.service';

function createFixture() {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(async () => ({
        id: 'owner_admin_1',
        email: 'owner@publ.dev',
        loginId: null,
        providerUserId: 'google:owner_admin_1'
      }))
    },
    senderNumber: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'sender_new',
        ownerUserId: data.ownerUserId,
        phoneNumber: data.phoneNumber,
        type: data.type,
        status: data.status,
        telecomCertificatePath: data.telecomCertificatePath,
        consentDocumentPath: data.consentDocumentPath,
        personalInfoConsentPath: data.personalInfoConsentPath,
        idCardCopyPath: data.idCardCopyPath,
        thirdPartyBusinessRegistrationPath: data.thirdPartyBusinessRegistrationPath,
        relationshipProofPath: data.relationshipProofPath,
        additionalDocumentPath: data.additionalDocumentPath,
        createdAt: new Date('2026-03-17T09:00:00.000Z')
      })),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id === 'sender_1') {
          return {
            id: 'sender_1',
            ownerUserId: 'owner_admin_1',
            phoneNumber: '01097690373',
            status: 'SUBMITTED'
          };
        }

        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id === 'sender_1') {
          return {
            id: 'sender_1',
            ownerUserId: 'owner_admin_1',
            phoneNumber: '01097690373',
            status: 'SUBMITTED'
          };
        }

        return null;
      }),
      update: jest.fn(async ({ data }: any) => ({
        id: 'sender_1',
        ...data
      })),
      updateMany: jest.fn(async () => ({ count: 1 }))
    }
  };

  const nhnService = {
    fetchApprovedSendNumbers: jest.fn(async () => ['01097690373'])
  };

  const operatorNotifications = {
    notifySenderNumberApplication: jest.fn(async () => true)
  };

  return {
    prisma,
    nhnService,
    operatorNotifications,
    service: new SenderNumbersService(prisma as any, nhnService as any, operatorNotifications as any)
  };
}

describe('SenderNumbersService', () => {
  it('sends an operator email after a sender number application is created', async () => {
    const { operatorNotifications, service } = createFixture();

    await service.apply(
      'owner_admin_1',
      {
        phoneNumber: '01012341234',
        type: 'EMPLOYEE'
      } as any,
      {
        telecom: 'uploads/telecom.pdf',
        consent: 'uploads/consent.pdf',
        idCardCopy: 'uploads/id-card-copy.pdf'
      },
      {
        email: 'owner@publ.dev'
      }
    );

    expect(operatorNotifications.notifySenderNumberApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner_admin_1',
        userLabel: 'owner@publ.dev',
        phoneNumber: '01012341234',
        applicantEmail: 'owner@publ.dev',
        submittedAt: new Date('2026-03-17T09:00:00.000Z')
      })
    );
  });

  it('keeps the sender number application even when email delivery fails', async () => {
    const { operatorNotifications, prisma, service } = createFixture();
    operatorNotifications.notifySenderNumberApplication.mockRejectedValueOnce(new Error('SMTP timeout'));

    await expect(
      service.apply(
        'owner_admin_1',
        {
          phoneNumber: '01012341234',
          type: 'EMPLOYEE'
        } as any,
        {
          telecom: 'uploads/telecom.pdf',
          consent: 'uploads/consent.pdf',
          idCardCopy: 'uploads/id-card-copy.pdf'
        },
        {
          email: 'owner@publ.dev'
        }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'sender_new',
        phoneNumber: '01012341234',
        status: 'SUBMITTED'
      })
    );

    expect(prisma.senderNumber.create).toHaveBeenCalled();
  });

  it('syncs NHN registration timestamps without auto-approving local sender numbers', async () => {
    const { prisma, service } = createFixture();

    const result = await service.syncApprovedFromNhn('owner_admin_1');

    expect(prisma.senderNumber.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerUserId: 'owner_admin_1',
          phoneNumber: { in: ['01097690373'] }
        },
        data: expect.objectContaining({
          syncedAt: expect.any(Date)
        })
      })
    );

    const updateManyPayload = (prisma.senderNumber.updateMany as jest.Mock).mock.calls[0][0];
    expect(updateManyPayload.data.status).toBeUndefined();
    expect(updateManyPayload.data.approvedAt).toBeUndefined();
    expect(result).toEqual({ synced: 1, nhnRegistered: 1 });
  });

  it('requires NHN-approved sendNos before an operator can approve a sender number', async () => {
    const { nhnService, service } = createFixture();
    nhnService.fetchApprovedSendNumbers.mockResolvedValueOnce([]);

    await expect(service.approveForOperator('sender_1', 'operator_1', '검토 완료')).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores reviewer information when the sender number is manually approved', async () => {
    const { prisma, service } = createFixture();

    await service.approveForOperator('sender_1', 'operator_1', '내부 심사 승인');

    expect(prisma.senderNumber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sender_1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedBy: 'operator_1',
          reviewMemo: '내부 심사 승인',
          approvedAt: expect.any(Date)
        })
      })
    );
  });
});
