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
  | 'businessRegistration'
  | 'relationshipProof'
  | 'additional'
  | 'employment';

@Injectable()
export class SenderNumbersService {
  private readonly logger = new Logger(SenderNumbersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly operatorNotifications: OperatorNotificationsService
  ) {}

  async list(tenantId: string) {
    return this.prisma.senderNumber.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async apply(
    tenantId: string,
    dto: CreateSenderNumberDto,
    files: {
      telecom?: string;
      consent?: string;
      thirdPartyBusinessRegistration?: string;
      relationshipProof?: string;
      additionalDocument?: string;
    },
    submittedBy?: {
      email?: string | null;
    }
  ) {
    if (!files.telecom) {
      throw new BadRequestException('통신서비스 이용증명원을 첨부하세요.');
    }

    if (!files.consent) {
      throw new BadRequestException('이용승낙서를 첨부하세요.');
    }

    if (dto.type === 'COMPANY') {
      if (!files.thirdPartyBusinessRegistration) {
        throw new BadRequestException('번호 명의 사업자등록증을 첨부하세요.');
      }

      if (!files.relationshipProof) {
        throw new BadRequestException('관계 확인 문서를 첨부하세요.');
      }
    }

    const created = await this.prisma.senderNumber.create({
      data: {
        tenantId,
        phoneNumber: dto.phoneNumber,
        type: dto.type,
        status: 'SUBMITTED',
        telecomCertificatePath: files.telecom,
        consentDocumentPath: files.consent,
        thirdPartyBusinessRegistrationPath: files.thirdPartyBusinessRegistration,
        relationshipProofPath: files.relationshipProof,
        additionalDocumentPath: files.additionalDocument
      },
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
        submittedAt: created.createdAt
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

  async listRegisteredFromNhn(tenantId: string) {
    const [registeredNumbers, localSenderNumbers] = await Promise.all([
      this.nhnService.fetchRegisteredSendNumbers(),
      this.prisma.senderNumber.findMany({
        where: { tenantId },
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

  async syncApprovedFromNhn(tenantId: string) {
    const approvedNumbers = await this.nhnService.fetchApprovedSendNumbers();
    if (approvedNumbers.length === 0) {
      return { synced: 0, nhnRegistered: 0 };
    }

    const result = await this.prisma.senderNumber.updateMany({
      where: {
        tenantId,
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
