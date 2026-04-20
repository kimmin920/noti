import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageChannel, TemplateStatus } from '@prisma/client';
import { extractRequiredVariables, renderTemplate } from '@publ/shared';
import { PrismaService } from '../database/prisma.service';
import { NhnService } from '../nhn/nhn.service';
import { CreateTemplateDto, UpdateTemplateDto } from './templates.dto';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService
  ) {}

  async list(ownerUserId: string, channel?: MessageChannel) {
    return this.prisma.template.findMany({
      where: {
        ownerUserId: ownerUserId,
        ...(channel ? { channel } : {})
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        },
        providerTemplates: true
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async create(userId: string, dto: CreateTemplateDto) {
    const ownerUserId = userId;
    const requiredVariables = extractRequiredVariables(dto.body);

    const template = await this.prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          ownerUserId: ownerUserId,
          channel: dto.channel,
          name: dto.name,
          body: dto.body,
          syntax: dto.channel === 'SMS' ? 'MUSTACHE_LIKE' : 'KAKAO_HASH',
          requiredVariables,
          status: 'DRAFT'
        }
      });

      await tx.templateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          bodySnapshot: template.body,
          requiredVariablesSnapshot: requiredVariables,
          createdBy: userId
        }
      });

      return template;
    });

    if (dto.channel === 'ALIMTALK') {
      const providerSync = await this.nhnService.requestAlimtalkTemplateSync({
        name: dto.name,
        body: dto.body,
        templateCode: this.buildTemplateCode(template.id)
      });

      await this.prisma.providerTemplate.create({
        data: {
          id: `provider_${template.id}`,
          ownerUserId: ownerUserId,
          templateId: template.id,
          channel: 'ALIMTALK',
          providerStatus: providerSync.providerStatus,
          nhnTemplateId: providerSync.nhnTemplateId,
          templateCode: providerSync.templateCode,
          kakaoTemplateCode: providerSync.kakaoTemplateCode,
          lastSyncedAt: new Date()
        }
      });
    }

    return template;
  }

  async update(userId: string, templateId: string, dto: UpdateTemplateDto) {
    const ownerUserId = userId;
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, ownerUserId: ownerUserId },
      include: {
        providerTemplates: true
      }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const nextBody = dto.body ?? template.body;
    const nextName = dto.name ?? template.name;
    const requiredVariables = extractRequiredVariables(nextBody);
    const providerSync =
      template.channel === 'ALIMTALK'
        ? await this.nhnService.requestAlimtalkTemplateSync({
            existingTemplateCode: template.providerTemplates[0]?.templateCode ?? undefined,
            templateCode: template.providerTemplates[0]?.templateCode ?? this.buildTemplateCode(template.id),
            name: nextName,
            body: nextBody
          })
        : null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.template.update({
        where: { id: template.id },
        data: {
          name: nextName,
          body: nextBody,
          requiredVariables
        }
      });

      if (providerSync) {
        await tx.providerTemplate.upsert({
          where: {
            id: template.providerTemplates[0]?.id ?? `provider_${template.id}`
          },
          update: {
            providerStatus: providerSync.providerStatus,
            nhnTemplateId: providerSync.nhnTemplateId,
            templateCode: providerSync.templateCode,
            kakaoTemplateCode: providerSync.kakaoTemplateCode,
            lastSyncedAt: new Date()
          },
          create: {
            id: template.providerTemplates[0]?.id ?? `provider_${template.id}`,
            ownerUserId: ownerUserId,
            templateId: template.id,
            channel: 'ALIMTALK',
            providerStatus: providerSync.providerStatus,
            nhnTemplateId: providerSync.nhnTemplateId,
            templateCode: providerSync.templateCode,
            kakaoTemplateCode: providerSync.kakaoTemplateCode,
            lastSyncedAt: new Date()
          }
        });
      }

      const latestVersion = await tx.templateVersion.findFirst({
        where: { templateId: template.id },
        orderBy: { version: 'desc' }
      });

      await tx.templateVersion.create({
        data: {
          templateId: template.id,
          version: (latestVersion?.version ?? 0) + 1,
          bodySnapshot: updated.body,
          requiredVariablesSnapshot: requiredVariables,
          createdBy: userId
        }
      });

      return updated;
    });
  }

  async publish(ownerUserId: string, templateId: string) {
    return this.updateStatus(ownerUserId, templateId, 'PUBLISHED');
  }

  async archive(ownerUserId: string, templateId: string) {
    return this.updateStatus(ownerUserId, templateId, 'ARCHIVED');
  }

  async versions(ownerUserId: string, templateId: string) {
    const template = await this.prisma.template.findFirst({ where: { id: templateId, ownerUserId: ownerUserId } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' }
    });
  }

  async preview(
    ownerUserId: string,
    templateId: string,
    variables: Record<string, string | number>
  ) {
    const template = await this.prisma.template.findFirst({
      where: {
        id: templateId,
        ownerUserId: ownerUserId
      }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return {
      rendered: renderTemplate(template.body, variables)
    };
  }

  async requestNhnSync(ownerUserId: string, templateId: string) {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, ownerUserId: ownerUserId },
      include: {
        providerTemplates: true
      }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.channel !== 'ALIMTALK') {
      throw new ConflictException('NHN sync is only available for ALIMTALK templates');
    }

    const provider = template.providerTemplates[0];
    const synced = await this.nhnService.requestAlimtalkTemplateSync({
      existingTemplateCode: provider?.templateCode ?? undefined,
      templateCode: provider?.templateCode ?? this.buildTemplateCode(template.id),
      name: template.name,
      body: template.body
    });

    const upserted = await this.prisma.providerTemplate.upsert({
      where: {
        id: provider?.id ?? `provider_${template.id}`
      },
      update: {
        providerStatus: synced.providerStatus,
        nhnTemplateId: synced.nhnTemplateId,
        templateCode: synced.templateCode,
        kakaoTemplateCode: synced.kakaoTemplateCode,
        lastSyncedAt: new Date()
      },
        create: {
          id: provider?.id ?? `provider_${template.id}`,
          ownerUserId: ownerUserId,
          templateId: template.id,
          channel: 'ALIMTALK',
        providerStatus: synced.providerStatus,
        nhnTemplateId: synced.nhnTemplateId,
        templateCode: synced.templateCode,
        kakaoTemplateCode: synced.kakaoTemplateCode,
        lastSyncedAt: new Date()
      }
    });

    return upserted;
  }

  private async updateStatus(ownerUserId: string, templateId: string, status: TemplateStatus) {
    const template = await this.prisma.template.findFirst({
      where: {
        id: templateId,
        ownerUserId: ownerUserId
      }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.template.update({
      where: { id: template.id },
      data: { status }
    });
  }

  private buildTemplateCode(templateId: string) {
    return `TPL${templateId.replace(/[^A-Za-z0-9]/g, '').slice(-17)}`.slice(0, 20);
  }
}
