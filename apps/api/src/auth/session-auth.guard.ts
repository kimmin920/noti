import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { EnvService } from '../common/env';
import { hashToken } from '../common/utils';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { SessionRequest } from '../common/session-request.interface';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<SessionRequest>();
    const token = req.cookies?.[this.env.cookieName] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Session cookie missing');
    }

    const tokenHash = hashToken(token, this.env.sessionSecret);
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true,
        tenant: {
          select: {
            accessOrigin: true
          }
        }
      }
    });

    if (!session || !['TENANT_ADMIN', 'PARTNER_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      throw new UnauthorizedException('Invalid session');
    }

    if (
      session.user.publUserId.startsWith('google:') &&
      !['TENANT_ADMIN', 'PARTNER_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)
    ) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      throw new UnauthorizedException('Google OAuth is only allowed for configured accounts');
    }

    req.sessionUser = {
      sessionId: session.id,
      tenantId: session.tenantId,
      userId: session.user.id,
      publUserId: session.user.publUserId,
      email: session.user.email,
      role: session.user.role,
      accessOrigin: session.user.accessOrigin ?? session.tenant.accessOrigin ?? 'DIRECT',
      partnerScope: session.user.partnerScope ?? null
    };

    return true;
  }
}
