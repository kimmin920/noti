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

const DEMO_PROVIDER_USER_ID = 'local:test1@vizuo.work';
const FORBIDDEN_DEMO_SENDER_NUMBER = '0212345678';

@Injectable()
export class SenderNumbersService {
  private readonly logger = new Logger(SenderNumbersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly operatorNotifications: OperatorNotificationsService
  ) {}

  async list(ownerUserId: string) {
    return this.prisma.senderNumber.findMany({
      where: {
        ownerUserId: ownerUserId
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getApplicationForUser(ownerUserId: string, senderNumberId: string) {
    const sender = await this.prisma.senderNumber.findFirst({
      where: {
        id: senderNumberId,
        ownerUserId: ownerUserId
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
    ownerUserId: string,
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
    const owner = await this.getOwnerContext(ownerUserId);
    const phoneNumber = dto.phoneNumber.trim();

    if (owner.providerUserId === DEMO_PROVIDER_USER_ID && phoneNumber === FORBIDDEN_DEMO_SENDER_NUMBER) {
      throw new ConflictException('이 데모 발신번호는 test1 계정에서 사용할 수 없습니다.');
    }

    const existing = await this.prisma.senderNumber.findFirst({
      where: {
        ownerUserId: ownerUserId,
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
      ownerUserId: ownerUserId,
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
          data: senderNumberData
        })
      : await this.prisma.senderNumber.create({
          data: senderNumberData
        });

    try {
      await this.operatorNotifications.notifySenderNumberApplication({
        userId: owner.id,
        userLabel: this.buildOwnerLabel(owner),
        phoneNumber: created.phoneNumber,
        type: created.type,
        applicantEmail: submittedBy?.email ?? null,
        submittedAt: existing ? created.updatedAt : created.createdAt
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Sender-number notification mail failed for ${owner.id}/${created.phoneNumber}: ${message}`);
    }
    return created;
  }

  async reviewQueue(ownerUserId: string) {
    return this.prisma.senderNumber.findMany({
      where: {
        ownerUserId,
        status: 'SUBMITTED'
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async listRegisteredFromNhn(ownerUserId: string) {
    const owner = await this.getOwnerContext(ownerUserId);
    const [registeredNumbers, localSenderNumbers] = await Promise.all([
      this.nhnService.fetchRegisteredSendNumbers(),
      this.prisma.senderNumber.findMany({
        where: {
          ownerUserId: ownerUserId
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

    const ownedPhoneNumbers = new Set(localSenderNumbers.map((item) => item.phoneNumber));
    const ownedRegisteredNumbers = registeredNumbers.filter((item) => ownedPhoneNumbers.has(item.sendNo));

    return this.mergeRegisteredSendNumbers(ownedRegisteredNumbers, localSenderNumbers);
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
    const items = await this.prisma.senderNumber.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });

    const owners = await this.loadOwners(items.map((item) => item.ownerUserId));
    return items.map((item) => ({
      ...item,
      user: {
        id: item.ownerUserId,
        name: this.buildOwnerLabel(owners.get(item.ownerUserId))
      }
    }));
  }

  async approve(ownerUserId: string, senderNumberId: string, reviewerId: string, memo?: string) {
    const sender = await this.prisma.senderNumber.findFirst({
      where: {
        id: senderNumberId,
        ownerUserId
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

  async reject(ownerUserId: string, senderNumberId: string, reviewerId: string, memo?: string) {
    const sender = await this.prisma.senderNumber.findFirst({
      where: {
        id: senderNumberId,
        ownerUserId
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
      where: { id: senderNumberId }
    });

    if (!sender) {
      throw new NotFoundException('Sender number not found');
    }

    const owner = await this.getOwnerContext(sender.ownerUserId);
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
      fileName: `${this.buildOwnerLabel(owner)}_${sender.phoneNumber}_${kind}${extension}`.replace(/\s+/g, '_')
    };
  }

  async syncApprovedFromNhn(ownerUserId: string) {
    const approvedNumbers = await this.nhnService.fetchApprovedSendNumbers();
    if (approvedNumbers.length === 0) {
      return { synced: 0, nhnRegistered: 0 };
    }

    const result = await this.prisma.senderNumber.updateMany({
      where: {
        ownerUserId: ownerUserId,
        phoneNumber: { in: approvedNumbers }
      },
      data: {
        syncedAt: new Date()
      }
    });

    return { synced: result.count, nhnRegistered: approvedNumbers.length };
  }

  private async getOwnerContext(ownerUserId: string) {
    const owner = await this.prisma.adminUser.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        email: true,
        loginId: true,
        providerUserId: true
      }
    });

    if (!owner) {
      throw new NotFoundException('Owner account not found');
    }

    return owner;
  }

  private async loadOwners(ownerUserIds: string[]) {
    const owners = await this.prisma.adminUser.findMany({
      where: {
        id: {
          in: [...new Set(ownerUserIds.filter(Boolean))]
        }
      },
      select: {
        id: true,
        email: true,
        loginId: true,
        providerUserId: true
      }
    });

    return new Map(owners.map((owner) => [owner.id, owner]));
  }

  private buildOwnerLabel(owner?: {
    id: string;
    email: string | null;
    loginId: string | null;
    providerUserId: string;
  } | null) {
    if (!owner) {
      return '알 수 없는 계정';
    }

    return owner.email?.trim() || owner.loginId?.trim() || owner.providerUserId || owner.id;
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
