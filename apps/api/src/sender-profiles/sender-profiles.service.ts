import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SenderProfile, SenderProfileStatus } from '@prisma/client';
import { EnvService } from '../common/env';
import { PrismaService } from '../database/prisma.service';
import {
  NhnAlimtalkSender,
  NhnAlimtalkSenderCategory,
  NhnAlimtalkTemplate,
  NhnSenderGroup,
  NhnService
} from '../nhn/nhn.service';
import {
  CreateSenderProfileApplicationDto,
  ListSenderProfilesDto,
  VerifySenderProfileTokenDto
} from './sender-profiles.dto';

const DEMO_TENANT_ID = 'tenant_demo';
const FORBIDDEN_DEMO_PLUS_FRIEND_ID = '@publ';
const FORBIDDEN_DEMO_SENDER_KEY = 'ALIM_SENDER_KEY_1';

@Injectable()
export class SenderProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly env: EnvService
  ) {}

  private isForbiddenDemoSender(
    tenantId: string,
    input: {
      plusFriendId?: string | null;
      senderKey?: string | null;
    }
  ): boolean {
    if (tenantId !== DEMO_TENANT_ID) {
      return false;
    }

    const plusFriendId = input.plusFriendId?.trim().toLowerCase() ?? '';
    const senderKey = input.senderKey?.trim().toLowerCase() ?? '';

    return plusFriendId === FORBIDDEN_DEMO_PLUS_FRIEND_ID || senderKey === FORBIDDEN_DEMO_SENDER_KEY.toLowerCase();
  }

  private assertAllowedDemoSender(
    tenantId: string,
    input: {
      plusFriendId?: string | null;
      senderKey?: string | null;
    }
  ): void {
    if (this.isForbiddenDemoSender(tenantId, input)) {
      throw new ConflictException('이 데모 카카오 채널은 tenant_demo에서 사용할 수 없습니다.');
    }
  }

  async listCategories(): Promise<NhnAlimtalkSenderCategory[]> {
    return this.nhnService.fetchSenderCategories();
  }

  async list(tenantId: string, query: ListSenderProfilesDto) {
    const shouldQueryNhn = Boolean(query.plusFriendId || query.senderKey || query.status);

    if (!shouldQueryNhn) {
      const localSenders = await this.prisma.senderProfile.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' }
      });

      return {
        source: 'local' as const,
        totalCount: localSenders.length,
        senders: localSenders.map((sender) => this.mapLocalSender(sender))
      };
    }

    const response = await this.nhnService.fetchSenderProfiles({
      plusFriendId: query.plusFriendId,
      senderKey: query.senderKey,
      status: query.status,
      pageNum: query.pageNum ?? 1,
      pageSize: query.pageSize ?? 20
    });

    const visibleSenders = response.senders.filter((sender) => !this.isForbiddenDemoSender(tenantId, sender));
    const senders = await Promise.all(
      visibleSenders.map(async (sender) => this.mergeRemoteWithLocal(sender, await this.syncRemoteSender(tenantId, sender)))
    );

    return {
      source: 'nhn' as const,
      totalCount: senders.length,
      senders
    };
  }

  async getBySenderKey(tenantId: string, senderKey: string) {
    this.assertAllowedDemoSender(tenantId, { senderKey });

    const sender = await this.nhnService.fetchSenderProfile(senderKey);

    if (!sender) {
      throw new NotFoundException('Sender profile not found');
    }

    const localSender = await this.syncRemoteSender(tenantId, sender);
    return this.mergeRemoteWithLocal(sender, localSender);
  }

  async apply(_tenantId: string, dto: CreateSenderProfileApplicationDto) {
    this.assertAllowedDemoSender(_tenantId, { plusFriendId: dto.plusFriendId });

    const result = await this.nhnService.registerSenderProfile(dto);

    return {
      ...result,
      sender: null
    };
  }

  async verifyToken(tenantId: string, dto: VerifySenderProfileTokenDto) {
    this.assertAllowedDemoSender(tenantId, { plusFriendId: dto.plusFriendId });

    const result = await this.nhnService.verifySenderProfileToken(dto);

    if (!result.sender) {
      return {
        ...result,
        sender: null,
        defaultGroupSync: {
          enabled: false,
          groupSenderKey: null,
          added: false,
          alreadyMember: false
        }
      };
    }

    const localSender = await this.syncRemoteSender(tenantId, result.sender);
    const defaultGroupSync = await this.nhnService.ensureSenderInDefaultGroup(result.sender.senderKey);

    return {
      ...result,
      sender: this.mergeRemoteWithLocal(result.sender, localSender),
      defaultGroupSync
    };
  }

  async getDefaultGroupStatus(): Promise<{
    configuredGroupKey: string | null;
    exists: boolean;
    group: NhnSenderGroup | null;
    error?: string;
  }> {
    const configuredGroupKey = this.env.nhnDefaultSenderGroupKey.trim() || null;

    if (!configuredGroupKey) {
      return {
        configuredGroupKey: null,
        exists: false,
        group: null
      };
    }

    try {
      const group = await this.nhnService.fetchSenderGroup(configuredGroupKey);
      return {
        configuredGroupKey,
        exists: group !== null,
        group
      };
    } catch (error) {
      return {
        configuredGroupKey,
        exists: false,
        group: null,
        error: error instanceof Error ? error.message : 'Unknown sender group error'
      };
    }
  }

  async getDefaultGroupTemplates(): Promise<{
    configuredGroupKey: string | null;
    exists: boolean;
    templates: NhnAlimtalkTemplate[];
    totalCount: number;
    error?: string;
  }> {
    const groupStatus = await this.getDefaultGroupStatus();

    if (!groupStatus.configuredGroupKey || !groupStatus.exists) {
      return {
        configuredGroupKey: groupStatus.configuredGroupKey,
        exists: false,
        templates: [],
        totalCount: 0,
        error: groupStatus.error
      };
    }

    try {
      const response = await this.nhnService.fetchTemplatesForSenderOrGroup(groupStatus.configuredGroupKey, {
        pageNum: 1,
        pageSize: 100
      });

      return {
        configuredGroupKey: groupStatus.configuredGroupKey,
        exists: true,
        templates: response.templates,
        totalCount: response.totalCount
      };
    } catch (error) {
      return {
        configuredGroupKey: groupStatus.configuredGroupKey,
        exists: true,
        templates: [],
        totalCount: 0,
        error: error instanceof Error ? error.message : 'Unknown group template error'
      };
    }
  }

  async syncSenderToDefaultGroup(tenantId: string, senderKey: string) {
    this.assertAllowedDemoSender(tenantId, { senderKey });

    const localSender = await this.prisma.senderProfile.findFirst({
      where: {
        tenantId,
        senderKey
      }
    });

    if (!localSender) {
      throw new NotFoundException('Sender profile not found');
    }

    return this.nhnService.ensureSenderInDefaultGroup(senderKey);
  }

  private async trySyncSenderByPlusFriendId(tenantId: string, plusFriendId: string) {
    this.assertAllowedDemoSender(tenantId, { plusFriendId });

    const response = await this.nhnService.fetchSenderProfiles({
      plusFriendId,
      pageNum: 1,
      pageSize: 20
    });

    const sender = response.senders.find((item) => item.plusFriendId === plusFriendId);

    if (!sender) {
      return null;
    }

    const localSender = await this.syncRemoteSender(tenantId, sender);
    return this.mergeRemoteWithLocal(sender, localSender);
  }

  private async syncRemoteSender(tenantId: string, sender: NhnAlimtalkSender): Promise<SenderProfile> {
    this.assertAllowedDemoSender(tenantId, sender);

    return this.prisma.senderProfile.upsert({
      where: {
        tenantId_senderKey: {
          tenantId,
          senderKey: sender.senderKey
        }
      },
      update: {
        plusFriendId: sender.plusFriendId,
        status: this.mapSenderStatus(sender)
      },
      create: {
        tenantId,
        plusFriendId: sender.plusFriendId,
        senderKey: sender.senderKey,
        senderProfileType: 'NORMAL',
        status: this.mapSenderStatus(sender)
      }
    });
  }

  private mergeRemoteWithLocal(sender: NhnAlimtalkSender, localSender: SenderProfile) {
    return {
      ...sender,
      localSenderProfileId: localSender.id,
      localStatus: localSender.status,
      senderProfileType: localSender.senderProfileType
    };
  }

  private mapLocalSender(sender: SenderProfile) {
    return {
      plusFriendId: sender.plusFriendId,
      senderKey: sender.senderKey,
      localSenderProfileId: sender.id,
      localStatus: sender.status,
      senderProfileType: sender.senderProfileType,
      status: null,
      statusName: null,
      kakaoStatus: null,
      kakaoStatusName: null,
      kakaoProfileStatus: null,
      kakaoProfileStatusName: null,
      categoryCode: null,
      profileSpamLevel: null,
      profileMessageSpamLevel: null,
      dormant: sender.status === 'DORMANT',
      block: sender.status === 'BLOCKED',
      createDate: null,
      initialUserRestriction: null,
      alimtalk: null,
      friendtalk: null
    };
  }

  private mapSenderStatus(sender: NhnAlimtalkSender): SenderProfileStatus {
    if (sender.block || sender.kakaoProfileStatus === 'B') {
      return 'BLOCKED';
    }

    if (sender.dormant || ['C', 'D', 'E'].includes(sender.kakaoProfileStatus ?? '')) {
      return 'DORMANT';
    }

    if (sender.status === 'YSC03' || sender.kakaoProfileStatus === 'A') {
      return 'ACTIVE';
    }

    return 'UNKNOWN';
  }
}
