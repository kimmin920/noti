import { Injectable } from '@nestjs/common';

@Injectable()
export class EnvService {
  private getValue(key: string, fallback = ''): string {
    const value = process.env[key];
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    return value;
  }

  private getSameSiteValue(
    key: string,
    fallback: 'lax' | 'strict' | 'none'
  ): 'lax' | 'strict' | 'none' {
    const value = this.getValue(key, fallback).toLowerCase();
    if (value === 'none' || value === 'strict' || value === 'lax') {
      return value;
    }
    return fallback;
  }

  private normalizeHttpOrigin(value: string): string | null {
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

  get nodeEnv(): string {
    return this.getValue('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get swaggerEnabled(): boolean {
    return this.getValue('SWAGGER_ENABLED', this.isProduction ? 'false' : 'true') === 'true';
  }

  get trustProxy(): boolean | number | string {
    const value = this.getValue('TRUST_PROXY', 'loopback, linklocal, uniquelocal').trim();
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }

    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 0) {
      return numeric;
    }

    return value;
  }

  get cookieName(): string {
    return this.getValue('COOKIE_NAME', 'pm_session');
  }

  get cookieSecure(): boolean {
    return this.getValue('COOKIE_SECURE', 'false') === 'true';
  }

  get cookieSameSite(): 'lax' | 'strict' | 'none' {
    return this.getSameSiteValue('COOKIE_SAMESITE', 'lax');
  }

  get cookieDomain(): string | undefined {
    const value = this.getValue('COOKIE_DOMAIN', '');
    return value || undefined;
  }

  get cookieMaxAgeSeconds(): number {
    return Number(this.getValue('COOKIE_MAX_AGE_SECONDS', '86400'));
  }

  get publSsoSecret(): string {
    return this.getValue('PUBL_SSO_HS256_SECRET', '');
  }

  get sessionSecret(): string {
    return this.getValue('SESSION_SECRET', '');
  }

  get localPasswordLoginEnabled(): boolean {
    return this.getValue(
      'LOCAL_PASSWORD_LOGIN_ENABLED',
      this.nodeEnv === 'production' ? 'false' : 'true'
    ) === 'true';
  }

  get adminBaseUrl(): string {
    return this.getValue('ADMIN_BASE_URL', 'http://localhost:3010');
  }

  get smtpHost(): string {
    return this.getValue('SMTP_HOST', '');
  }

  get smtpPort(): number {
    return Number(this.getValue('SMTP_PORT', '587'));
  }

  get smtpSecure(): boolean {
    const fallback = this.smtpPort === 465 ? 'true' : 'false';
    return this.getValue('SMTP_SECURE', fallback) === 'true';
  }

  get smtpUser(): string {
    return this.getValue('SMTP_USER', '');
  }

  get smtpPass(): string {
    return this.getValue('SMTP_PASS', '');
  }

  get smtpFrom(): string {
    return this.getValue('SMTP_FROM', '');
  }

  get smtpReplyTo(): string | undefined {
    const value = this.getValue('SMTP_REPLY_TO', '');
    return value || undefined;
  }

  get senderNumberApplicationNotifyEmails(): string[] {
    const configured = this.getValue('SENDER_NUMBER_APPLICATION_NOTIFY_EMAILS', '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return configured.length > 0 ? configured : this.superAdminEmails;
  }

  get googleOauthClientId(): string {
    return this.getValue('GOOGLE_OAUTH_CLIENT_ID', '');
  }

  get googleOauthClientSecret(): string {
    return this.getValue('GOOGLE_OAUTH_CLIENT_SECRET', '');
  }

  get googleOauthAllowedDomain(): string {
    return this.getValue('GOOGLE_OAUTH_ALLOWED_DOMAIN', '');
  }

  get googleOauthOperatorEmails(): string[] {
    return this.getValue('GOOGLE_OAUTH_OPERATOR_EMAILS', '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  get superAdminEmails(): string[] {
    const configured = this.getValue('SUPER_ADMIN_EMAILS', '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    return configured.length > 0 ? configured : this.googleOauthOperatorEmails;
  }

  get googleOauthStateCookieName(): string {
    return this.getValue('GOOGLE_OAUTH_STATE_COOKIE_NAME', 'pm_oauth_state');
  }

  get googleOauthStateCookieSecure(): boolean {
    return this.getValue('GOOGLE_OAUTH_STATE_COOKIE_SECURE', String(this.cookieSecure)) === 'true';
  }

  get googleOauthStateCookieSameSite(): 'lax' | 'strict' | 'none' {
    return this.getSameSiteValue('GOOGLE_OAUTH_STATE_COOKIE_SAMESITE', 'lax');
  }

  get googleOauthStateCookieDomain(): string | undefined {
    const value = this.getValue('GOOGLE_OAUTH_STATE_COOKIE_DOMAIN', '');
    return value || undefined;
  }

  get googleOauthStateMaxAgeSeconds(): number {
    return Number(this.getValue('GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS', '600'));
  }

  get notionOauthClientId(): string {
    return this.getValue('NOTION_OAUTH_CLIENT_ID', '');
  }

  get notionOauthClientSecret(): string {
    return this.getValue('NOTION_OAUTH_CLIENT_SECRET', '');
  }

  get notionOauthRedirectUri(): string {
    return this.getValue('NOTION_OAUTH_REDIRECT_URI', '');
  }

  get notionApiVersion(): string {
    return this.getValue('NOTION_API_VERSION', '2026-03-11');
  }

  get notionTokenEncryptionSecret(): string {
    return this.getValue('NOTION_TOKEN_ENCRYPTION_SECRET', '');
  }

  get storageDriver(): 'local' | 'r2' {
    const value = this.getValue('STORAGE_DRIVER', 'local').toLowerCase();
    return value === 'r2' ? 'r2' : 'local';
  }

  get uploadStorageLocalDir(): string {
    return this.getValue('UPLOAD_STORAGE_LOCAL_DIR', 'uploads');
  }

  get uploadStorageKeyPrefix(): string {
    return this.getValue('UPLOAD_STORAGE_KEY_PREFIX', '');
  }

  get r2Endpoint(): string {
    return this.getValue('R2_ENDPOINT', '');
  }

  get r2Region(): string {
    return this.getValue('R2_REGION', 'auto');
  }

  get r2Bucket(): string {
    return this.getValue('R2_BUCKET', '');
  }

  get r2AccessKeyId(): string {
    return this.getValue('R2_ACCESS_KEY_ID', '');
  }

  get r2SecretAccessKey(): string {
    return this.getValue('R2_SECRET_ACCESS_KEY', '');
  }

  get corsOrigins(): string[] {
    return this.getValue('CORS_ALLOW_ORIGINS', '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  get redisUrl(): string {
    return this.getValue('REDIS_URL', 'redis://localhost:6379');
  }

  get queueName(): string {
    return this.getValue('BULLMQ_QUEUE_NAME', 'publ_messaging_queue');
  }

  get publServiceToken(): string {
    return this.getValue('PUBL_SERVICE_TOKEN', '');
  }

  get nhnOAuthUrl(): string {
    return this.getValue('NHN_OAUTH_BASE_URL', 'https://oauth.api.nhncloudservice.com');
  }

  get nhnAppKey(): string {
    return this.getValue('NHN_NOTIFICATION_HUB_APP_KEY', '');
  }

  get nhnUserAccessKeyId(): string {
    return this.getValue('NHN_USER_ACCESS_KEY_ID', '');
  }

  get nhnSecretAccessKey(): string {
    return this.getValue('NHN_SECRET_ACCESS_KEY', '');
  }

  get nhnSmsBaseUrl(): string {
    return this.getValue('NHN_SMS_BASE_URL', 'https://api-sms.cloud.toast.com');
  }

  get nhnSmsAppKey(): string {
    return this.getValue('NHN_SMS_APP_KEY', this.nhnAppKey);
  }

  get nhnSmsSecretKey(): string {
    return this.getValue('NHN_SMS_SECRET_KEY', '');
  }

  get nhnAlimtalkBaseUrl(): string {
    return this.getValue('NHN_ALIMTALK_BASE_URL', 'https://api-alimtalk.cloud.toast.com');
  }

  get nhnAlimtalkAppKey(): string {
    return this.getValue('NHN_ALIMTALK_APP_KEY', this.nhnAppKey);
  }

  get nhnAlimtalkSecretKey(): string {
    return this.getValue('NHN_ALIMTALK_SECRET_KEY', '');
  }

  get nhnDefaultSenderGroupKey(): string {
    return this.getValue('NHN_DEFAULT_SENDER_GROUP_KEY', 'PUBL');
  }

  get nhnWebhookSignatureSecret(): string {
    return this.getValue('NHN_WEBHOOK_SIGNATURE_SECRET', '');
  }

  isPlaceholder(value: string): boolean {
    return !value || value.includes('__REPLACE_ME__');
  }

  validateStartupConfig(): void {
    if (!this.isProduction) {
      return;
    }

    const errors: string[] = [];
    const requiredSecrets = [
      'SESSION_SECRET',
      'PUBL_SSO_HS256_SECRET',
      'PUBL_SERVICE_TOKEN',
      'NHN_WEBHOOK_SIGNATURE_SECRET'
    ];

    for (const key of requiredSecrets) {
      if (this.isPlaceholder(this.getValue(key, ''))) {
        errors.push(`${key} must be configured`);
      }
    }

    if (!this.cookieSecure) {
      errors.push('COOKIE_SECURE must be true');
    }

    if (this.cookieSameSite === 'none' && !this.cookieSecure) {
      errors.push('COOKIE_SECURE must be true when COOKIE_SAMESITE=none');
    }

    if (this.localPasswordLoginEnabled) {
      errors.push('LOCAL_PASSWORD_LOGIN_ENABLED must be false');
    }

    if (this.getValue('NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED', 'false') === 'true') {
      errors.push('NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED must be false');
    }

    if (this.swaggerEnabled) {
      errors.push('SWAGGER_ENABLED must be false');
    }

    if (this.trustProxy === true) {
      errors.push('TRUST_PROXY must not be true; use a hop count, subnet, or named range');
    }

    if (this.corsOrigins.length === 0) {
      errors.push('CORS_ALLOW_ORIGINS must include at least one admin origin');
    }

    for (const origin of this.corsOrigins) {
      if (origin === '*' || !this.normalizeHttpOrigin(origin)) {
        errors.push(`CORS_ALLOW_ORIGINS contains an invalid origin: ${origin}`);
      }
    }

    if (!this.normalizeHttpOrigin(this.adminBaseUrl)) {
      errors.push('ADMIN_BASE_URL must be a valid http(s) origin');
    }

    if (this.storageDriver === 'r2') {
      if (!this.normalizeHttpOrigin(this.r2Endpoint)) {
        errors.push('R2_ENDPOINT must be a valid http(s) origin when STORAGE_DRIVER=r2');
      }
      if (this.isPlaceholder(this.r2Bucket)) {
        errors.push('R2_BUCKET must be configured when STORAGE_DRIVER=r2');
      }
      if (this.isPlaceholder(this.r2AccessKeyId)) {
        errors.push('R2_ACCESS_KEY_ID must be configured when STORAGE_DRIVER=r2');
      }
      if (this.isPlaceholder(this.r2SecretAccessKey)) {
        errors.push('R2_SECRET_ACCESS_KEY must be configured when STORAGE_DRIVER=r2');
      }
    }

    const notionOAuthPartiallyConfigured = Boolean(
      this.notionOauthClientId ||
      this.notionOauthClientSecret ||
      this.notionOauthRedirectUri
    );
    if (notionOAuthPartiallyConfigured) {
      if (this.isPlaceholder(this.notionOauthClientId)) {
        errors.push('NOTION_OAUTH_CLIENT_ID must be configured when Notion OAuth is enabled');
      }
      if (this.isPlaceholder(this.notionOauthClientSecret)) {
        errors.push('NOTION_OAUTH_CLIENT_SECRET must be configured when Notion OAuth is enabled');
      }
      if (this.notionOauthRedirectUri && !this.normalizeHttpOrigin(this.notionOauthRedirectUri)) {
        errors.push('NOTION_OAUTH_REDIRECT_URI must be a valid http(s) URL');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid production configuration:\n- ${errors.join('\n- ')}`);
    }
  }
}
