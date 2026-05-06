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

const DEMO_PROVIDER_USER_ID = 'local:test1@vizuo.work';
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
    ownerProviderUserId: string,
    input: {
      plusFriendId?: string | null;
      senderKey?: string | null;
    }
  ): boolean {
    if (ownerProviderUserId !== DEMO_PROVIDER_USER_ID) {
      return false;
    }

    const plusFriendId = input.plusFriendId?.trim().toLowerCase() ?? '';
    const senderKey = input.senderKey?.trim().toLowerCase() ?? '';

    return plusFriendId === FORBIDDEN_DEMO_PLUS_FRIEND_ID || senderKey === FORBIDDEN_DEMO_SENDER_KEY.toLowerCase();
  }

  private assertAllowedDemoSender(
    ownerProviderUserId: string,
    input: {
      plusFriendId?: string | null;
      senderKey?: string | null;
    }
  ): void {
    if (this.isForbiddenDemoSender(ownerProviderUserId, input)) {
      throw new ConflictException('이 데모 카카오 채널은 test1 계정에서 사용할 수 없습니다.');
    }
  }

  async listCategories(): Promise<NhnAlimtalkSenderCategory[]> {
    return this.nhnService.fetchSenderCategories();
  }

  async list(ownerUserId: string, query: ListSenderProfilesDto) {
    const owner = await this.getOwnerContext(ownerUserId);
    const shouldQueryNhn = Boolean(query.plusFriendId || query.senderKey || query.status);

    if (!shouldQueryNhn) {
      const localSenders = await this.prisma.senderProfile.findMany({
        where: {
          ownerUserId: ownerUserId
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
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

    const visibleSenders = response.senders.filter((sender) => !this.isForbiddenDemoSender(owner.providerUserId, sender));
    const senders = [];
    for (const sender of visibleSenders) {
      senders.push(this.mergeRemoteWithLocal(sender, await this.syncRemoteSender(owner, sender)));
    }

    return {
      source: 'nhn' as const,
      totalCount: senders.length,
      senders
    };
  }

  async getBySenderKey(ownerUserId: string, senderKey: string) {
    const owner = await this.getOwnerContext(ownerUserId);
    this.assertAllowedDemoSender(owner.providerUserId, { senderKey });

    const sender = await this.nhnService.fetchSenderProfile(senderKey);

    if (!sender) {
      throw new NotFoundException('Sender profile not found');
    }

    const localSender = await this.syncRemoteSender(owner, sender);
    return this.mergeRemoteWithLocal(sender, localSender);
  }

  async apply(ownerUserId: string, dto: CreateSenderProfileApplicationDto) {
    const owner = await this.getOwnerContext(ownerUserId);
    this.assertAllowedDemoSender(owner.providerUserId, { plusFriendId: dto.plusFriendId });

    const result = await this.nhnService.registerSenderProfile(dto);

    return {
      ...result,
      sender: null
    };
  }

  async verifyToken(ownerUserId: string, dto: VerifySenderProfileTokenDto) {
    const owner = await this.getOwnerContext(ownerUserId);
    this.assertAllowedDemoSender(owner.providerUserId, { plusFriendId: dto.plusFriendId });

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

    const localSender = await this.syncRemoteSender(owner, result.sender);
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

  async syncSenderToDefaultGroup(ownerUserId: string, senderKey: string) {
    const owner = await this.getOwnerContext(ownerUserId);
    this.assertAllowedDemoSender(owner.providerUserId, { senderKey });

    const localSender = await this.prisma.senderProfile.findFirst({
      where: {
        ownerUserId: ownerUserId,
        senderKey
      }
    });

    if (!localSender) {
      throw new NotFoundException('Sender profile not found');
    }

    return this.nhnService.ensureSenderInDefaultGroup(senderKey);
  }

  async setDefault(ownerUserId: string, senderProfileId: string) {
    const sender = await this.prisma.senderProfile.findFirst({
      where: {
        id: senderProfileId,
        ownerUserId
      }
    });

    if (!sender) {
      throw new NotFoundException('Sender profile not found');
    }

    if (sender.status !== SenderProfileStatus.ACTIVE) {
      throw new ConflictException('활성 카카오 채널만 기본 채널로 설정할 수 있습니다.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.senderProfile.updateMany({
        where: {
          ownerUserId,
          isDefault: true,
          id: {
            not: sender.id
          }
        },
        data: {
          isDefault: false
        }
      });

      return tx.senderProfile.update({
        where: {
          id: sender.id
        },
        data: {
          isDefault: true
        }
      });
    });

    return this.mapLocalSender(updated);
  }

  private async trySyncSenderByPlusFriendId(ownerUserId: string, plusFriendId: string) {
    const owner = await this.getOwnerContext(ownerUserId);
    this.assertAllowedDemoSender(owner.providerUserId, { plusFriendId });

    const response = await this.nhnService.fetchSenderProfiles({
      plusFriendId,
      pageNum: 1,
      pageSize: 20
    });

    const sender = response.senders.find((item) => item.plusFriendId === plusFriendId);

    if (!sender) {
      return null;
    }

    const localSender = await this.syncRemoteSender(owner, sender);
    return this.mergeRemoteWithLocal(sender, localSender);
  }

  private async syncRemoteSender(
    owner: {
      id: string;
      providerUserId: string;
    },
    sender: NhnAlimtalkSender
  ): Promise<SenderProfile> {
    this.assertAllowedDemoSender(owner.providerUserId, sender);

    const existingDefault = await this.prisma.senderProfile.findFirst({
      where: {
        ownerUserId: owner.id,
        isDefault: true
      },
      select: {
        id: true
      }
    });

    const localSender = await this.prisma.senderProfile.upsert({
      where: {
        ownerUserId_senderKey: {
          ownerUserId: owner.id,
          senderKey: sender.senderKey
        }
      },
      update: {
        plusFriendId: sender.plusFriendId,
        status: this.mapSenderStatus(sender)
      },
      create: {
        ownerUserId: owner.id,
        plusFriendId: sender.plusFriendId,
        senderKey: sender.senderKey,
        senderProfileType: 'NORMAL',
        status: this.mapSenderStatus(sender),
        isDefault: !existingDefault
      }
    });

    if (!existingDefault && !localSender.isDefault) {
      return this.prisma.senderProfile.update({
        where: {
          id: localSender.id
        },
        data: {
          isDefault: true
        }
      });
    }

    return localSender;
  }

  private mergeRemoteWithLocal(sender: NhnAlimtalkSender, localSender: SenderProfile) {
    return {
      ...sender,
      localSenderProfileId: localSender.id,
      localStatus: localSender.status,
      isDefault: localSender.isDefault,
      senderProfileType: localSender.senderProfileType,
      createdAt: localSender.createdAt,
      updatedAt: localSender.updatedAt
    };
  }

  private mapLocalSender(sender: SenderProfile) {
    return {
      plusFriendId: sender.plusFriendId,
      senderKey: sender.senderKey,
      localSenderProfileId: sender.id,
      localStatus: sender.status,
      isDefault: sender.isDefault,
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
      createdAt: sender.createdAt,
      updatedAt: sender.updatedAt,
      initialUserRestriction: null,
      alimtalk: null,
      friendtalk: null
    };
  }

  private async getOwnerContext(ownerUserId: string) {
    const owner = await this.prisma.adminUser.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        providerUserId: true
      }
    });

    if (!owner) {
      throw new NotFoundException('Owner account not found');
    }

    return owner;
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
