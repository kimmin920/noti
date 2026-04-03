import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { EnvService } from './env';

type SenderNumberApplicationNotificationInput = {
  tenantId: string;
  tenantName?: string | null;
  phoneNumber: string;
  type: string;
  applicantEmail?: string | null;
  submittedAt: Date;
};

@Injectable()
export class OperatorNotificationsService {
  private readonly logger = new Logger(OperatorNotificationsService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly env: EnvService) {}

  async notifySenderNumberApplication(input: SenderNumberApplicationNotificationInput): Promise<boolean> {
    const recipients = this.env.senderNumberApplicationNotifyEmails;
    if (recipients.length === 0) {
      this.logger.warn('Skipping sender-number notification because no recipient email is configured.');
      return false;
    }

    if (!this.env.smtpHost || !this.env.smtpFrom) {
      this.logger.warn('Skipping sender-number notification because SMTP_HOST or SMTP_FROM is not configured.');
      return false;
    }

    const tenantLabel = input.tenantName?.trim() ? `${input.tenantName} (${input.tenantId})` : input.tenantId;
    const reviewUrl = `${this.env.adminBaseUrl.replace(/\/$/, '')}/internal`;
    const subject = `[NOTI] 새 발신번호 신청 - ${input.phoneNumber}`;
    const typeLabel = this.getSenderTypeLabel(input.type);
    const text = [
      '새 발신번호 신청이 접수되었습니다.',
      '',
      `테넌트: ${tenantLabel}`,
      `발신번호: ${input.phoneNumber}`,
      `유형: ${typeLabel}`,
      `신청자 이메일: ${input.applicantEmail ?? '-'}`,
      `신청 시각: ${input.submittedAt.toISOString()}`,
      `내부 심사: ${reviewUrl}`
    ].join('\n');

    await this.getTransporter().sendMail({
      from: this.env.smtpFrom,
      to: recipients.join(', '),
      replyTo: this.env.smtpReplyTo,
      subject,
      text
    });

    return true;
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.env.smtpHost,
      port: this.env.smtpPort,
      secure: this.env.smtpSecure,
      auth:
        this.env.smtpUser || this.env.smtpPass
          ? {
              user: this.env.smtpUser,
              pass: this.env.smtpPass
            }
          : undefined
    });

    return this.transporter;
  }

  private getSenderTypeLabel(type: string): string {
    if (type === 'COMPANY') {
      return '법인/사업자 번호';
    }

    if (type === 'EMPLOYEE') {
      return '타인 번호';
    }

    return type;
  }
}
