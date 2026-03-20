import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { SessionRequest } from '../common/session-request.interface';
import { EnvService } from '../common/env';
import { createSessionToken } from '../common/utils';

export type GoogleOauthRequestContext = {
  redirectUri: string;
  returnTo: string;
};

type PendingGoogleOauthState = {
  expiresAt: number;
  fingerprint: string;
} & GoogleOauthRequestContext;

@Injectable()
export class GoogleOauthStateService {
  private readonly pendingStates = new Map<string, PendingGoogleOauthState>();

  constructor(private readonly env: EnvService) {}

  issue(req: SessionRequest, context: GoogleOauthRequestContext): string {
    this.pruneExpired();

    const state = createSessionToken();
    const expiresAt = Date.now() + this.env.googleOauthStateMaxAgeSeconds * 1000;
    this.pendingStates.set(state, {
      expiresAt,
      fingerprint: this.buildFingerprint(req),
      redirectUri: context.redirectUri,
      returnTo: context.returnTo
    });

    return state;
  }

  consume(state: string, req: SessionRequest): GoogleOauthRequestContext | null {
    this.pruneExpired();

    const pending = this.pendingStates.get(state);
    this.pendingStates.delete(state);

    if (!pending || pending.expiresAt < Date.now()) {
      return null;
    }

    const expected = Buffer.from(pending.fingerprint, 'hex');
    const actual = Buffer.from(this.buildFingerprint(req), 'hex');

    if (expected.length !== actual.length) {
      return null;
    }

    if (!timingSafeEqual(expected, actual)) {
      return null;
    }

    return {
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
      // OAuth can start from localhost and return on the public callback host.
      .update([userAgent, acceptLanguage, secChUa, secChUaPlatform].join('|'))
      .digest('hex');
  }
}
