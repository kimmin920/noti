import { Injectable } from '@nestjs/common';
import { CreateManagedUserDto } from '../../users/users.dto';
import { UsersService } from '../../users/users.service';

@Injectable()
export class V2RecipientsService {
  constructor(private readonly usersService: UsersService) {}

  async listRecipients(ownerUserId: string) {
    const data = await this.usersService.list(ownerUserId);

    return {
      fields: data.fields,
      summary: {
        totalCount: data.summary.totalUsers,
        activeCount: data.summary.activeUsers,
        inactiveCount: data.summary.inactiveUsers,
        dormantCount: data.summary.dormantUsers,
        blockedCount: data.summary.blockedUsers,
        sourceCount: data.summary.sourceCount,
        customFieldCount: data.summary.customFieldCount,
        phoneCount: data.users.filter((user) => Boolean(user.phone)).length,
        marketingConsentCount: data.users.filter((user) => user.marketingConsent === true).length
      },
      sourceBreakdown: data.sourceBreakdown,
      items: data.users.map((user) => ({
        id: user.id,
        source: user.source,
        externalId: user.externalId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        userType: user.userType,
        segment: user.segment,
        gradeOrLevel: user.gradeOrLevel,
        marketingConsent: user.marketingConsent,
        tags: Array.isArray(user.tags) ? user.tags : [],
        registeredAt: user.registeredAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        customAttributes: user.customAttributes
      }))
    };
  }

  async createRecipient(ownerUserId: string, dto: CreateManagedUserDto) {
    const result = await this.usersService.createManualUser(ownerUserId, dto);

    return {
      mode: result.mode,
      user: {
        id: result.user.id,
        source: result.user.source,
        externalId: result.user.externalId,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        status: result.user.status,
        userType: result.user.userType,
        segment: result.user.segment,
        gradeOrLevel: result.user.gradeOrLevel,
        marketingConsent: result.user.marketingConsent,
        tags: Array.isArray(result.user.tags) ? result.user.tags : [],
        registeredAt: result.user.registeredAt,
        lastLoginAt: result.user.lastLoginAt,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
        customAttributes: result.user.customAttributes
      }
    };
  }
}
