import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { SessionRequest } from '../../common/session-request.interface';
import { EnvService } from '../../common/env';
import { createSessionToken } from '../../common/utils';

export type NotionOauthRequestContext = {
  ownerUserId: string;
  redirectUri: string;
  returnTo: string;
};

type PendingNotionOauthState = {
  expiresAt: number;
  fingerprint: string;
} & NotionOauthRequestContext;

@Injectable()
export class NotionOauthStateService {
  private readonly pendingStates = new Map<string, PendingNotionOauthState>();

  constructor(private readonly env: EnvService) {}

  issue(req: SessionRequest, context: NotionOauthRequestContext): string {
    this.pruneExpired();

    const state = createSessionToken();
    const expiresAt = Date.now() + this.env.googleOauthStateMaxAgeSeconds * 1000;
    this.pendingStates.set(state, {
      expiresAt,
      fingerprint: this.buildFingerprint(req),
      ownerUserId: context.ownerUserId,
      redirectUri: context.redirectUri,
      returnTo: context.returnTo
    });

    return state;
  }

  consume(state: string, req: SessionRequest): NotionOauthRequestContext | null {
    this.pruneExpired();

    const pending = this.pendingStates.get(state);
    this.pendingStates.delete(state);

    if (!pending || pending.expiresAt < Date.now()) {
      return null;
    }

    const expected = Buffer.from(pending.fingerprint, 'hex');
    const actual = Buffer.from(this.buildFingerprint(req), 'hex');

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    return {
      ownerUserId: pending.ownerUserId,
      redirectUri: pending.redirectUri,
      returnTo: pending.returnTo
    };
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [state, pending] of this.pendingStates.entries()) {
      if (pending.expiresAt < now) {
        this.pendingStates.delete(state);
      }
    }
  }

  private buildFingerprint(req: SessionRequest): string {
    const userAgent = req.get('user-agent') ?? '';
    const acceptLanguage = req.get('accept-language') ?? '';
    const secChUa = req.get('sec-ch-ua') ?? '';
    const secChUaPlatform = req.get('sec-ch-ua-platform') ?? '';

    return createHash('sha256')
      .update([userAgent, acceptLanguage, secChUa, secChUaPlatform].join('|'))
      .digest('hex');
  }
}
