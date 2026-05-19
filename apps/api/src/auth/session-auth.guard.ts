import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { EnvService } from '../common/env';
import { hashToken } from '../common/utils';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { SessionRequest } from '../common/session-request.interface';

function readSessionCookieValues(req: SessionRequest, cookieName: string): string[] {
  const values: string[] = [];
  const rawCookieHeader = req.headers.cookie;

  if (typeof rawCookieHeader === 'string') {
    for (const part of rawCookieHeader.split(';')) {
      const trimmed = part.trim();
      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = trimmed.slice(0, separatorIndex).trim();
      if (name !== cookieName) {
        continue;
      }

      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      try {
        values.push(decodeURIComponent(rawValue));
      } catch {
        values.push(rawValue);
      }
    }
  }

  const parsedCookieValue = req.cookies?.[cookieName] as string | undefined;
  if (parsedCookieValue && !values.includes(parsedCookieValue)) {
    values.push(parsedCookieValue);
  }

  return values.filter(Boolean);
}

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
    const tokens = readSessionCookieValues(req, this.env.cookieName);
    if (tokens.length === 0) {
      throw new UnauthorizedException('Session cookie missing');
    }

    const tokenHashes = Array.from(
      new Set(tokens.map((token) => hashToken(token, this.env.sessionSecret)))
    );
    const sessions = await this.prisma.session.findMany({
      where: {
        tokenHash: { in: tokenHashes },
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });
    const sessionByTokenHash = new Map(sessions.map((session) => [session.tokenHash, session]));
    const session = tokenHashes
      .map((tokenHash) => sessionByTokenHash.get(tokenHash))
      .find((candidate) => candidate && ['USER', 'PARTNER_ADMIN', 'SUPER_ADMIN'].includes(candidate.user.role));

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    req.sessionUser = {
      sessionId: session.id,
      userId: session.user.id,
      providerUserId: session.user.providerUserId,
      loginProvider: session.user.loginProvider,
      email: session.user.email,
      role: session.user.role,
      accessOrigin: session.user.accessOrigin ?? 'DIRECT'
    };

    return true;
  }
}
