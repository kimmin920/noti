import { BadRequestException, ConflictException } from '@nestjs/common';
import { Sms080ServiceStatus, Sms080ServiceType } from '@prisma/client';
import { Sms080ServicesService } from '../src/sms-080/sms-080.service';

function createFixture() {
  const owner = {
    id: 'owner_admin_1',
    email: 'owner@publ.dev',
    loginId: null,
    providerUserId: 'google:owner_admin_1'
  };
  const application = {
    id: 'sms080_1',
    ownerUserId: owner.id,
    type: Sms080ServiceType.NHN_MANAGED,
    status: Sms080ServiceStatus.SUBMITTED,
    unsubscribeNumber: null,
    businessName: '비즈우',
    providerName: 'NHN Cloud',
    reviewMemo: null,
    reviewedBy: null,
    approvedAt: null,
    createdAt: new Date('2026-05-15T09:00:00.000Z'),
    updatedAt: new Date('2026-05-15T09:00:00.000Z')
  };
  const prisma = {
    adminUser: {
      findUnique: jest.fn(async () => owner),
      findMany: jest.fn(async () => [owner])
    },
    sms080Service: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async ({ where }: any) => (where.id === application.id ? application : null)),
      create: jest.fn(async ({ data }: any) => ({
        id: 'sms080_new',
        ...data,
        createdAt: new Date('2026-05-15T09:00:00.000Z'),
        updatedAt: new Date('2026-05-15T09:00:00.000Z')
      })),
      update: jest.fn(async ({ data }: any) => ({
        ...application,
        ...data,
        updatedAt: new Date('2026-05-15T10:00:00.000Z')
      }))
    }
  };

  return {
    owner,
    application,
    prisma,
    service: new Sms080ServicesService(prisma as any)
  };
}

describe('Sms080ServicesService', () => {
  it('creates a pending NHN-managed 080 application without an assigned number', async () => {
    const { owner, prisma, service } = createFixture();

    await service.createApplication(owner.id, {
      type: Sms080ServiceType.NHN_MANAGED,
      businessName: '비즈우'
    });

    expect(prisma.sms080Service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: owner.id,
          type: Sms080ServiceType.NHN_MANAGED,
          status: Sms080ServiceStatus.SUBMITTED,
          unsubscribeNumber: null,
          businessName: '비즈우',
          providerName: 'NHN Cloud'
        })
      })
    );
  });

  it('creates a pending external 080 application with a normalized number', async () => {
    const { owner, prisma, service } = createFixture();

    await service.createApplication(owner.id, {
      type: Sms080ServiceType.EXTERNAL,
      unsubscribeNumber: '080-1234-5678',
      businessName: '비즈우',
      providerName: '외부 업체'
    });

    expect(prisma.sms080Service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: Sms080ServiceType.EXTERNAL,
          status: Sms080ServiceStatus.SUBMITTED,
          unsubscribeNumber: '08012345678',
          providerName: '외부 업체'
        })
      })
    );
  });

  it('blocks an already approved external 080 number from being submitted again', async () => {
    const { owner, prisma, service } = createFixture();
    prisma.sms080Service.findFirst.mockResolvedValueOnce({
      id: 'sms080_existing',
      ownerUserId: owner.id,
      unsubscribeNumber: '08012345678',
      status: Sms080ServiceStatus.APPROVED
    } as any);

    await expect(
      service.createApplication(owner.id, {
        type: Sms080ServiceType.EXTERNAL,
        unsubscribeNumber: '08012345678',
        businessName: '비즈우'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires an assigned 080 number before approving an NHN-managed application', async () => {
    const { service } = createFixture();

    await expect(
      service.approveForOperator('sms080_1', 'operator_1', {
        memo: '승인'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the assigned 080 number and reviewer when approved', async () => {
    const { prisma, service } = createFixture();

    await service.approveForOperator('sms080_1', 'operator_1', {
      unsubscribeNumber: '080-8888-1375',
      memo: '개통 완료'
    });

    expect(prisma.sms080Service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sms080_1' },
        data: expect.objectContaining({
          status: Sms080ServiceStatus.APPROVED,
          unsubscribeNumber: '08088881375',
          reviewedBy: 'operator_1',
          reviewMemo: '개통 완료',
          approvedAt: expect.any(Date)
        })
      })
    );
  });
});
