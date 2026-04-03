import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import * as path from 'path';
import { OperatorNotificationsService } from '../common/operator-notifications.service';
import { PrismaService } from '../database/prisma.service';
import { NhnService } from '../nhn/nhn.service';
import { CreateSenderNumberDto } from './sender-numbers.dto';

type SenderNumberAttachmentKind =
  | 'telecom'
  | 'consent'
  | 'personalInfoConsent'
  | 'idCardCopy'
  | 'businessRegistration'
  | 'relationshipProof'
  | 'additional'
  | 'employment';

const DEMO_TENANT_ID = 'tenant_demo';
const FORBIDDEN_DEMO_SENDER_NUMBER = '0212345678';

@Injectable()
export class SenderNumbersService {
  private readonly logger = new Logger(SenderNumbersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly operatorNotifications: OperatorNotificationsService
  ) {}

  async list(tenantId: string, ownerAdminUserId: string) {
    return this.prisma.senderNumber.findMany({
      where: {
        tenantId,
        ownerAdminUserId
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getApplicationForOwner(tenantId: string, ownerAdminUserId: string, senderNumberId: string) {
    const sender = await this.prisma.senderNumber.findFirst({
      where: {
        id: senderNumberId,
        tenantId,
        ownerAdminUserId
      },
      select: {
        id: true,
        phoneNumber: true,
        type: true,
        status: true,
        reviewMemo: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
        telecomCertificatePath: true,
        consentDocumentPath: true,
        personalInfoConsentPath: true,
        idCardCopyPath: true,
        thirdPartyBusinessRegistrationPath: true,
        relationshipProofPath: true,
        additionalDocumentPath: true,
        employmentCertificatePath: true
      }
    });

    if (!sender) {
      throw new NotFoundException('Sender number application not found');
    }

    return {
      ...sender,
      attachments: {
        telecom: Boolean(sender.telecomCertificatePath),
        consent: Boolean(sender.consentDocumentPath),
        personalInfoConsent: Boolean(sender.personalInfoConsentPath),
        idCardCopy: Boolean(sender.idCardCopyPath),
        businessRegistration: Boolean(sender.thirdPartyBusinessRegistrationPath),
        relationshipProof: Boolean(sender.relationshipProofPath),
        additional: Boolean(sender.additionalDocumentPath),
        employment: Boolean(sender.employmentCertificatePath)
      }
    };
  }

  async apply(
    tenantId: string,
    ownerAdminUserId: string,
    dto: CreateSenderNumberDto,
    files: {
      telecom?: string;
      consent?: string;
      personalInfoConsent?: string;
      idCardCopy?: string;
      thirdPartyBusinessRegistration?: string;
      relationshipProof?: string;
      additionalDocument?: string;
    },
    submittedBy?: {
      email?: string | null;
    }
  ) {
    const phoneNumber = dto.phoneNumber.trim();

    if (tenantId === DEMO_TENANT_ID && phoneNumber === FORBIDDEN_DEMO_SENDER_NUMBER) {
      throw new ConflictException('이 데모 발신번호는 tenant_demo에서 사용할 수 없습니다.');
    }

    const existing = await this.prisma.senderNumber.findFirst({
      where: {
        tenantId,
        ownerAdminUserId,
        phoneNumber
      }
    });

    const telecomCertificatePath = files.telecom ?? existing?.telecomCertificatePath ?? null;
    const consentDocumentPath = files.consent ?? existing?.consentDocumentPath ?? null;
    const personalInfoConsentPath = files.personalInfoConsent ?? existing?.personalInfoConsentPath ?? null;
    const idCardCopyPath = files.idCardCopy ?? existing?.idCardCopyPath ?? null;
    const thirdPartyBusinessRegistrationPath =
      files.thirdPartyBusinessRegistration ?? existing?.thirdPartyBusinessRegistrationPath ?? null;
    const relationshipProofPath = files.relationshipProof ?? existing?.relationshipProofPath ?? null;
    const additionalDocumentPath = files.additionalDocument ?? existing?.additionalDocumentPath ?? null;

    if (!telecomCertificatePath) {
      throw new BadRequestException('통신서비스 이용증명원을 첨부하세요.');
    }

    if (!consentDocumentPath) {
      throw new BadRequestException('이용승낙서를 첨부하세요.');
    }

    if (dto.type === 'EMPLOYEE' && !idCardCopyPath) {
      throw new BadRequestException('신분증 사본을 첨부하세요. 주민등록번호 뒷자리는 마스킹해 주세요.');
    }

    if (dto.type === 'COMPANY') {
      if (!thirdPartyBusinessRegistrationPath) {
        throw new BadRequestException('번호 명의 사업자등록증을 첨부하세요.');
      }

      if (!relationshipProofPath) {
        throw new BadRequestException('관계 확인 문서를 첨부하세요.');
      }
    }

    if (existing?.status === 'SUBMITTED') {
      throw new ConflictException('이미 심사 중인 발신번호입니다. 현재 신청 상태를 확인해 주세요.');
    }

    if (existing?.status === 'APPROVED') {
      throw new ConflictException('이미 등록된 발신번호입니다.');
    }

    const senderNumberData = {
      tenantId,
      ownerAdminUserId,
      phoneNumber,
      type: dto.type,
      status: 'SUBMITTED' as const,
      telecomCertificatePath,
      consentDocumentPath,
      personalInfoConsentPath: dto.type === 'EMPLOYEE' ? personalInfoConsentPath : null,
      idCardCopyPath: dto.type === 'EMPLOYEE' ? idCardCopyPath : null,
      thirdPartyBusinessRegistrationPath: dto.type === 'COMPANY' ? thirdPartyBusinessRegistrationPath : null,
      relationshipProofPath: dto.type === 'COMPANY' ? relationshipProofPath : null,
      additionalDocumentPath,
      reviewMemo: null,
      reviewedBy: null,
      approvedAt: null,
      syncedAt: null
    };

    const created = existing
      ? await this.prisma.senderNumber.update({
          where: { id: existing.id },
          data: senderNumberData,
          include: {
            tenant: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
      : await this.prisma.senderNumber.create({
          data: senderNumberData,
          include: {
            tenant: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

    try {
      await this.operatorNotifications.notifySenderNumberApplication({
        tenantId,
        tenantName: created.tenant.name,
        phoneNumber: created.phoneNumber,
        type: created.type,
        applicantEmail: submittedBy?.email ?? null,
        submittedAt: existing ? created.updatedAt : created.createdAt
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Sender-number notification mail failed for ${tenantId}/${created.phoneNumber}: ${message}`);
    }

    const { tenant, ...senderNumber } = created;
    return senderNumber;
  }

  async reviewQueue(tenantId: string) {
    return this.prisma.senderNumber.findMany({
      where: {
        tenantId,
        status: 'SUBMITTED'
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async listRegisteredFromNhn(tenantId: string, ownerAdminUserId: string) {
    const [registeredNumbers, localSenderNumbers] = await Promise.all([
      this.nhnService.fetchRegisteredSendNumbers(),
      this.prisma.senderNumber.findMany({
        where: {
          tenantId,
          ownerAdminUserId
        },
        select: {
          id: true,
          phoneNumber: true,
          status: true,
          type: true
        }
      })
    ]);

    if (localSenderNumbers.length === 0) {
      return [];
    }

    const tenantPhoneNumbers = new Set(localSenderNumbers.map((item) => item.phoneNumber));
    const tenantRegisteredNumbers = registeredNumbers.filter((item) => tenantPhoneNumbers.has(item.sendNo));

    return this.mergeRegisteredSendNumbers(tenantRegisteredNumbers, localSenderNumbers);
  }

  async listRegisteredFromNhnForOperator() {
    const [registeredNumbers, localSenderNumbers] = await Promise.all([
      this.nhnService.fetchRegisteredSendNumbers(),
      this.prisma.senderNumber.findMany({
        select: {
          id: true,
          phoneNumber: true,
          status: true,
          type: true
        }
      })
    ]);

    return this.mergeRegisteredSendNumbers(registeredNumbers, localSenderNumbers);
  }

  async listAllForOperator() {
    return this.prisma.senderNumber.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async approve(tenantId: string, senderNumberId: string, reviewerId: string, memo?: string) {
    const sender = await this.prisma.senderNumber.findFirst({
      where: {
        id: senderNumberId,
        tenantId
      }
    });

    if (!sender) {
      throw new NotFoundException('Sender number not found');
    }

    await this.assertApprovedInNhn(sender.phoneNumber);

    return this.prisma.senderNumber.update({
      where: { id: sender.id },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewMemo: memo,
        approvedAt: new Date()
      }
    });
  }

  async approveForOperator(senderNumberId: string, reviewerId: string, memo?: string) {
    const sender = await this.prisma.senderNumber.findUnique({
      where: { id: senderNumberId }
    });

    if (!sender) {
      throw new NotFoundException('Sender number not found');
    }

    await this.assertApprovedInNhn(sender.phoneNumber);

    return this.prisma.senderNumber.update({
      where: { id: sender.id },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewMemo: memo,
        approvedAt: new Date()
      }
    });
  }

  async reject(tenantId: string, senderNumberId: string, reviewerId: string, memo?: string) {
    const sender = await this.prisma.senderNumber.findFirst({
      where: {
        id: senderNumberId,
        tenantId
      }
    });

    if (!sender) {
      throw new NotFoundException('Sender number not found');
    }

    return this.prisma.senderNumber.update({
      where: { id: sender.id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewMemo: memo
      }
    });
  }

  async rejectForOperator(senderNumberId: string, reviewerId: string, memo?: string) {
    const sender = await this.prisma.senderNumber.findUnique({
      where: { id: senderNumberId }
    });

    if (!sender) {
      throw new NotFoundException('Sender number not found');
    }

    return this.prisma.senderNumber.update({
      where: { id: sender.id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewMemo: memo
      }
    });
  }

  async requestSupplementForOperator(senderNumberId: string, reviewerId: string, memo?: string) {
    const sender = await this.prisma.senderNumber.findUnique({
      where: { id: senderNumberId }
    });

    if (!sender) {
      throw new NotFoundException('Sender number not found');
    }

    return this.prisma.senderNumber.update({
      where: { id: sender.id },
      data: {
        status: 'SUPPLEMENT_REQUESTED',
        reviewedBy: reviewerId,
        reviewMemo: memo
      }
    });
  }

  async getAttachmentForOperator(senderNumberId: string, kind: SenderNumberAttachmentKind) {
    const sender = await this.prisma.senderNumber.findUnique({
      where: { id: senderNumberId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!sender) {
      throw new NotFoundException('Sender number not found');
    }

    const storedPathByKind: Record<SenderNumberAttachmentKind, string | null> = {
      telecom: sender.telecomCertificatePath,
      consent: sender.consentDocumentPath,
      personalInfoConsent: sender.personalInfoConsentPath,
      idCardCopy: sender.idCardCopyPath,
      businessRegistration: sender.thirdPartyBusinessRegistrationPath,
      relationshipProof: sender.relationshipProofPath,
      additional: sender.additionalDocumentPath,
      employment: sender.employmentCertificatePath
    };
    const storedPath = storedPathByKind[kind];

    if (!storedPath) {
      throw new NotFoundException('Attachment not found');
    }

    const resolvedPath = this.resolveAttachmentPath(storedPath);
    const extension = path.extname(resolvedPath) || '.pdf';

    return {
      filePath: resolvedPath,
      fileName: `${sender.tenant.name}_${sender.phoneNumber}_${kind}${extension}`.replace(/\s+/g, '_')
    };
  }

  async syncApprovedFromNhn(tenantId: string, ownerAdminUserId: string) {
    const approvedNumbers = await this.nhnService.fetchApprovedSendNumbers();
    if (approvedNumbers.length === 0) {
      return { synced: 0, nhnRegistered: 0 };
    }

    const result = await this.prisma.senderNumber.updateMany({
      where: {
        tenantId,
        ownerAdminUserId,
        phoneNumber: { in: approvedNumbers }
      },
      data: {
        syncedAt: new Date()
      }
    });

    return { synced: result.count, nhnRegistered: approvedNumbers.length };
  }

  private mergeRegisteredSendNumbers(
    registeredNumbers: Awaited<ReturnType<NhnService['fetchRegisteredSendNumbers']>>,
    localSenderNumbers: Array<{
      id: string;
      phoneNumber: string;
      status: string;
      type: string;
    }>
  ) {
    const localMap = new Map<string, typeof localSenderNumbers>();

    for (const item of localSenderNumbers) {
      const group = localMap.get(item.phoneNumber) ?? [];
      group.push(item);
      localMap.set(item.phoneNumber, group);
    }

    return registeredNumbers.map((item) => {
      const linkedRows = localMap.get(item.sendNo) ?? [];
      const uniqueStatuses = [...new Set(linkedRows.map((row) => row.status))];
      const uniqueTypes = [...new Set(linkedRows.map((row) => row.type))];

      return {
        ...item,
        linkedToTenant: linkedRows.length > 0,
        localSenderNumberId: linkedRows[0]?.id ?? null,
        localStatus: uniqueStatuses.length > 0 ? uniqueStatuses.join(', ') : null,
        localType: uniqueTypes.length > 0 ? uniqueTypes.join(', ') : null
      };
    });
  }

  private async assertApprovedInNhn(phoneNumber: string): Promise<void> {
    const approvedNumbers = await this.nhnService.fetchApprovedSendNumbers();
    const isApproved = approvedNumbers.includes(phoneNumber);

    if (!isApproved) {
      throw new ConflictException('This sender number is not approved in the provider sendNos yet');
    }
  }

  private resolveAttachmentPath(storedPath: string): string {
    const fileName = path.basename(storedPath);
    const candidates = [
      storedPath,
      path.resolve(process.cwd(), storedPath),
      path.resolve(process.cwd(), 'uploads', fileName),
      path.resolve(process.cwd(), 'apps/api', storedPath),
      path.resolve(process.cwd(), 'apps/api/uploads', fileName),
      path.resolve(process.cwd(), '..', '..', storedPath),
      path.resolve(process.cwd(), '..', '..', 'apps/api/uploads', fileName)
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new NotFoundException('Stored attachment file was not found on disk');
  }
}
