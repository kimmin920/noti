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

  get nodeEnv(): string {
    return this.getValue('NODE_ENV', 'development');
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

  get adminBaseUrl(): string {
    return this.getValue('ADMIN_BASE_URL', 'http://localhost:3001');
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

    return configured.length > 0 ? configured : this.googleOauthOperatorEmails;
  }

  get googleOauthClientId(): string {
    return this.getValue('GOOGLE_OAUTH_CLIENT_ID', '');
  }

  get googleOauthClientSecret(): string {
    return this.getValue('GOOGLE_OAUTH_CLIENT_SECRET', '');
  }

  get googleOauthRedirectUri(): string {
    return this.getValue('GOOGLE_OAUTH_REDIRECT_URI', '');
  }

  get googleOauthAllowedDomain(): string {
    return this.getValue('GOOGLE_OAUTH_ALLOWED_DOMAIN', '');
  }

  get googleOauthDefaultTenantId(): string {
    return this.getValue('GOOGLE_OAUTH_DEFAULT_TENANT_ID', '');
  }

  get googleOauthDefaultTenantName(): string {
    return this.getValue('GOOGLE_OAUTH_DEFAULT_TENANT_NAME', 'Google Tenant');
  }

  get googleOauthOperatorEmails(): string[] {
    return this.getValue('GOOGLE_OAUTH_OPERATOR_EMAILS', '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  get googleOauthOperatorTenantId(): string {
    return this.getValue('GOOGLE_OAUTH_OPERATOR_TENANT_ID', 'tenant_internal_ops');
  }

  get googleOauthOperatorTenantName(): string {
    return this.getValue('GOOGLE_OAUTH_OPERATOR_TENANT_NAME', 'Publ Internal Operations');
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

  get nhnBaseUrl(): string {
    return this.getValue('NHN_NOTIFICATION_HUB_BASE_URL', 'https://notification-hub.api.nhncloudservice.com');
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

  get nhnRateLimitRps(): number {
    return Number(this.getValue('NHN_RATE_LIMIT_RPS', '300'));
  }

  get resultPollerIntervalSeconds(): number {
    return Number(this.getValue('RESULT_POLLER_INTERVAL_SECONDS', '120'));
  }

  isPlaceholder(value: string): boolean {
    return !value || value.includes('__REPLACE_ME__');
  }

  get isNhnMockMode(): boolean {
    return (
      this.isPlaceholder(this.nhnAppKey) ||
      this.isPlaceholder(this.nhnUserAccessKeyId) ||
      this.isPlaceholder(this.nhnSecretAccessKey)
    );
  }
}
