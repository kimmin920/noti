import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ManagedUserStatus, UserRole } from '@prisma/client';
import { SessionUser } from '../../common/session-request.interface';
import { PrismaService } from '../../database/prisma.service';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';

@Injectable()
export class V2PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getOverview(sessionUser: SessionUser) {
    if (sessionUser.partnerScope !== 'PUBL') {
      return {
        summary: {
          tenantCount: 0,
          tenantAdminCount: 0,
          smsReadyTenantCount: 0,
          kakaoReadyTenantCount: 0,
          managedUserCount: 0
        },
        tenants: [],
        adminUsers: []
      };
    }

    const tenants = await this.prisma.tenant.findMany({
      where: {
        accessOrigin: 'PUBL'
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        status: true,
        accessOrigin: true,
        createdAt: true,
        updatedAt: true,
        users: {
          where: {
            role: UserRole.TENANT_ADMIN
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            loginId: true,
            email: true,
            accessOrigin: true,
            createdAt: true,
            updatedAt: true
          }
        },
        senderNumbers: {
          where: {
            status: 'APPROVED'
          },
          select: {
            id: true
          }
        },
        senderProfiles: {
          where: {
            status: 'ACTIVE'
          },
          select: {
            id: true
          }
        },
        _count: {
          select: {
            managedUsers: {
              where: {
                status: {
                  not: ManagedUserStatus.BLOCKED
                }
              }
            }
          }
        }
      }
    });

    const tenantItems = tenants.map((tenant) => {
      const primaryAdmin = tenant.users[0] ?? null;

      return {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        accessOrigin: tenant.accessOrigin,
        tenantAdminCount: tenant.users.length,
        approvedSenderNumberCount: tenant.senderNumbers.length,
        activeSenderProfileCount: tenant.senderProfiles.length,
        managedUserCount: tenant._count.managedUsers,
        primaryAdmin: primaryAdmin
          ? {
              id: primaryAdmin.id,
              loginId: primaryAdmin.loginId,
              email: primaryAdmin.email
            }
          : null,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      };
    });

    const adminUsers = tenantItems
      .flatMap((tenant) =>
        tenants
          .find((item) => item.id === tenant.id)!
          .users.map((user) => ({
            id: user.id,
            tenantId: tenant.id,
            tenantName: tenant.name,
            loginId: user.loginId,
            email: user.email,
            accessOrigin: user.accessOrigin,
            approvedSenderNumberCount: tenant.approvedSenderNumberCount,
            activeSenderProfileCount: tenant.activeSenderProfileCount,
            managedUserCount: tenant.managedUserCount,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }))
      )
      .sort((left, right) => {
        const rightTime = Date.parse(right.updatedAt.toISOString());
        const leftTime = Date.parse(left.updatedAt.toISOString());
        return rightTime - leftTime;
      });

    return {
      summary: {
        tenantCount: tenantItems.length,
        tenantAdminCount: adminUsers.length,
        smsReadyTenantCount: tenantItems.filter((item) => item.approvedSenderNumberCount > 0).length,
        kakaoReadyTenantCount: tenantItems.filter((item) => item.activeSenderProfileCount > 0).length,
        managedUserCount: tenantItems.reduce((sum, item) => sum + item.managedUserCount, 0)
      },
      tenants: tenantItems,
      adminUsers
    };
  }

  async getTenantDetail(sessionUser: SessionUser, tenantId: string) {
    if (sessionUser.partnerScope !== 'PUBL') {
      throw new ForbiddenException('PUBL partner scope is required');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        accessOrigin: 'PUBL'
      },
      select: {
        id: true,
        name: true,
        status: true,
        accessOrigin: true,
        createdAt: true,
        updatedAt: true,
        users: {
          where: {
            role: UserRole.TENANT_ADMIN
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            loginId: true,
            email: true,
            accessOrigin: true,
            createdAt: true,
            updatedAt: true
          }
        },
        senderNumbers: {
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            phoneNumber: true,
            type: true,
            status: true,
            reviewMemo: true,
            approvedAt: true,
            createdAt: true,
            updatedAt: true
          }
        },
        senderProfiles: {
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            plusFriendId: true,
            senderKey: true,
            senderProfileType: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        },
        _count: {
          select: {
            managedUsers: {
              where: {
                status: {
                  not: ManagedUserStatus.BLOCKED
                }
              }
            },
            templates: true,
            eventRules: {
              where: {
                enabled: true
              }
            },
            messageRequests: {
              where: {
                createdAt: {
                  gte: sevenDaysAgo()
                }
              }
            },
            bulkSmsCampaigns: {
              where: {
                createdAt: {
                  gte: sevenDaysAgo()
                }
              }
            },
            bulkAlimtalkCampaigns: {
              where: {
                createdAt: {
                  gte: sevenDaysAgo()
                }
              }
            }
          }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundException('Partner tenant not found');
    }

    const kakaoCatalog = await this.kakaoTemplateCatalogService.getTemplateCatalog(tenant.id, {
      includeDefaultGroup: false,
      groupScope: null
    });

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        accessOrigin: tenant.accessOrigin,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      },
      summary: {
        tenantAdminCount: tenant.users.length,
        approvedSenderNumberCount: tenant.senderNumbers.filter((item) => item.status === 'APPROVED').length,
        activeSenderProfileCount: tenant.senderProfiles.filter((item) => item.status === 'ACTIVE').length,
        managedUserCount: tenant._count.managedUsers,
        smsTemplateCount: tenant._count.templates,
        enabledEventRuleCount: tenant._count.eventRules,
        approvedKakaoTemplateCount: kakaoCatalog.summary.approvedCount,
        recentManualRequestCount: tenant._count.messageRequests,
        recentBulkCampaignCount: tenant._count.bulkSmsCampaigns + tenant._count.bulkAlimtalkCampaigns
      },
      adminUsers: tenant.users,
      senderNumbers: tenant.senderNumbers,
      senderProfiles: tenant.senderProfiles
    };
  }
}

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
