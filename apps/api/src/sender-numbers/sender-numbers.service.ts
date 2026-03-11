import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import * as path from 'path';
import { PrismaService } from '../database/prisma.service';
import { NhnService } from '../nhn/nhn.service';
import { CreateSenderNumberDto } from './sender-numbers.dto';

@Injectable()
export class SenderNumbersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService
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
    files: { telecom?: string; employment?: string }
  ) {
    return this.prisma.senderNumber.create({
      data: {
        tenantId,
        phoneNumber: dto.phoneNumber,
        type: dto.type,
        status: 'SUBMITTED',
        telecomCertificatePath: files.telecom,
        employmentCertificatePath: files.employment
      }
    });
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

    await this.assertRegisteredInNhn(sender.phoneNumber);

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

    await this.assertRegisteredInNhn(sender.phoneNumber);

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

  async getAttachmentForOperator(senderNumberId: string, kind: 'telecom' | 'employment') {
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

    const storedPath =
      kind === 'telecom' ? sender.telecomCertificatePath : sender.employmentCertificatePath;

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
      return { synced: 0 };
    }

    const result = await this.prisma.senderNumber.updateMany({
      where: {
        tenantId,
        phoneNumber: { in: approvedNumbers }
      },
      data: {
        status: 'APPROVED',
        syncedAt: new Date(),
        approvedAt: new Date()
      }
    });

    return { synced: result.count };
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

  private async assertRegisteredInNhn(phoneNumber: string): Promise<void> {
    const registeredNumbers = await this.nhnService.fetchRegisteredSendNumbers();
    const isRegistered = registeredNumbers.some((item) => item.sendNo === phoneNumber);

    if (!isRegistered) {
      throw new ConflictException('This sender number is not registered in NHN sendNos yet');
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
