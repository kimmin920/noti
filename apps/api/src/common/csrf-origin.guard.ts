import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { EnvService } from './env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    if (SAFE_METHODS.has(method)) {
      return true;
    }

    const requestOrigin = this.normalizeOrigin(this.getRequestOrigin(req));
    const suppliedOrigin = this.normalizeOrigin(this.readHeader(req, 'origin'));
    const suppliedRefererOrigin = this.normalizeOrigin(this.readHeader(req, 'referer'));
    const browserOrigin = suppliedOrigin ?? suppliedRefererOrigin;

    if (!browserOrigin) {
      return true;
    }

    const allowedOrigins = this.getAllowedOrigins(requestOrigin);
    if (!allowedOrigins.has(browserOrigin)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }

  private getAllowedOrigins(requestOrigin: string | null): Set<string> {
    const origins = new Set<string>();

    if (requestOrigin) {
      origins.add(requestOrigin);
    }

    const adminOrigin = this.normalizeOrigin(this.env.adminBaseUrl);
    if (adminOrigin) {
      origins.add(adminOrigin);
    }

    for (const origin of this.env.corsOrigins) {
      const normalized = this.normalizeOrigin(origin);
      if (normalized) {
        origins.add(normalized);
      }
    }

    return origins;
  }

  private getRequestOrigin(req: Request): string {
    const forwardedProto = this.readHeader(req, 'x-forwarded-proto')
      .split(',')[0]
      ?.trim()
      .toLowerCase();
    const forwardedHost = this.readHeader(req, 'x-forwarded-host')
      .split(',')[0]
      ?.trim();
    const protocol = forwardedProto || req.protocol || (req.secure ? 'https' : 'http');
    const host = forwardedHost || this.readHeader(req, 'host');

    return host ? `${protocol}://${host}` : '';
  }

  private readHeader(req: Request, name: string): string {
    const value = req.get(name);
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeOrigin(value: string): string | null {
    if (!value || value === 'null') {
      return null;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }
}
