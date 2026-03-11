-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT_ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'ALIMTALK');

-- CreateEnum
CREATE TYPE "ChannelStrategy" AS ENUM ('SMS_ONLY', 'ALIMTALK_ONLY', 'ALIMTALK_THEN_SMS');

-- CreateEnum
CREATE TYPE "MessagePurpose" AS ENUM ('NORMAL');

-- CreateEnum
CREATE TYPE "MessageRequestStatus" AS ENUM ('ACCEPTED', 'PROCESSING', 'SENT_TO_PROVIDER', 'DELIVERED', 'DELIVERY_FAILED', 'SEND_FAILED', 'CANCELED', 'DEAD');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProviderTemplateStatus" AS ENUM ('REG', 'REQ', 'APR', 'REJ');

-- CreateEnum
CREATE TYPE "SenderNumberType" AS ENUM ('COMPANY', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "SenderNumberStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SenderProfileStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DORMANT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publUserId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT_ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channelStrategy" "ChannelStrategy" NOT NULL,
    "messagePurpose" "MessagePurpose" NOT NULL DEFAULT 'NORMAL',
    "requiredVariables" JSONB NOT NULL,
    "smsTemplateId" TEXT,
    "smsSenderNumberId" TEXT,
    "alimtalkTemplateId" TEXT,
    "alimtalkSenderProfileId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "EventRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "syntax" TEXT NOT NULL,
    "requiredVariables" JSONB NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "bodySnapshot" TEXT NOT NULL,
    "requiredVariablesSnapshot" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "templateId" TEXT NOT NULL,
    "nhnTemplateId" TEXT,
    "templateCode" TEXT,
    "kakaoTemplateCode" TEXT,
    "providerStatus" "ProviderTemplateStatus" NOT NULL DEFAULT 'REG',
    "rejectedReason" TEXT,
    "block" BOOLEAN,
    "dormant" BOOLEAN,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenderNumber" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "type" "SenderNumberType" NOT NULL,
    "status" "SenderNumberStatus" NOT NULL DEFAULT 'DRAFT',
    "telecomCertificatePath" TEXT,
    "employmentCertificatePath" TEXT,
    "reviewMemo" TEXT,
    "reviewedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenderProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plusFriendId" TEXT NOT NULL,
    "senderKey" TEXT NOT NULL,
    "senderProfileType" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "SenderProfileStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "variablesJson" JSONB NOT NULL,
    "metadataJson" JSONB,
    "status" "MessageRequestStatus" NOT NULL DEFAULT 'ACCEPTED',
    "resolvedChannel" "MessageChannel",
    "resolvedSenderNumberId" TEXT,
    "resolvedSenderProfileId" TEXT,
    "resolvedTemplateId" TEXT,
    "resolvedProviderTemplateId" TEXT,
    "nhnMessageId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttempt" (
    "id" TEXT NOT NULL,
    "messageRequestId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "providerRequest" JSONB,
    "providerResponse" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryResult" (
    "id" TEXT NOT NULL,
    "messageRequestId" TEXT NOT NULL,
    "providerStatus" TEXT NOT NULL,
    "providerCode" TEXT,
    "providerMessage" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "headersJson" JSONB NOT NULL,
    "bodyJson" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "eventType" TEXT NOT NULL,
    "tenantId" TEXT,
    "processedAt" TIMESTAMP(3),
    "processError" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadLetter" (
    "id" TEXT NOT NULL,
    "messageRequestId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_tenantId_publUserId_key" ON "AdminUser"("tenantId", "publUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EventRule_tenantId_eventKey_key" ON "EventRule"("tenantId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_version_key" ON "TemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "ProviderTemplate_tenantId_providerStatus_idx" ON "ProviderTemplate"("tenantId", "providerStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SenderNumber_tenantId_phoneNumber_key" ON "SenderNumber"("tenantId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SenderProfile_tenantId_senderKey_key" ON "SenderProfile"("tenantId", "senderKey");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRequest_nhnMessageId_key" ON "MessageRequest"("nhnMessageId");

-- CreateIndex
CREATE INDEX "MessageRequest_tenantId_createdAt_idx" ON "MessageRequest"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MessageRequest_tenantId_eventKey_createdAt_idx" ON "MessageRequest"("tenantId", "eventKey", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MessageRequest_tenantId_idempotencyKey_key" ON "MessageRequest"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttempt_messageRequestId_attemptNumber_key" ON "MessageAttempt"("messageRequestId", "attemptNumber");

-- CreateIndex
CREATE INDEX "DeliveryResult_messageRequestId_createdAt_idx" ON "DeliveryResult"("messageRequestId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_smsTemplateId_fkey" FOREIGN KEY ("smsTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_smsSenderNumberId_fkey" FOREIGN KEY ("smsSenderNumberId") REFERENCES "SenderNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_alimtalkTemplateId_fkey" FOREIGN KEY ("alimtalkTemplateId") REFERENCES "ProviderTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_alimtalkSenderProfileId_fkey" FOREIGN KEY ("alimtalkSenderProfileId") REFERENCES "SenderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTemplate" ADD CONSTRAINT "ProviderTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTemplate" ADD CONSTRAINT "ProviderTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderNumber" ADD CONSTRAINT "SenderNumber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderProfile" ADD CONSTRAINT "SenderProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_resolvedSenderNumberId_fkey" FOREIGN KEY ("resolvedSenderNumberId") REFERENCES "SenderNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_resolvedSenderProfileId_fkey" FOREIGN KEY ("resolvedSenderProfileId") REFERENCES "SenderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_resolvedTemplateId_fkey" FOREIGN KEY ("resolvedTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_resolvedProviderTemplateId_fkey" FOREIGN KEY ("resolvedProviderTemplateId") REFERENCES "ProviderTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttempt" ADD CONSTRAINT "MessageAttempt_messageRequestId_fkey" FOREIGN KEY ("messageRequestId") REFERENCES "MessageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryResult" ADD CONSTRAINT "DeliveryResult_messageRequestId_fkey" FOREIGN KEY ("messageRequestId") REFERENCES "MessageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadLetter" ADD CONSTRAINT "DeadLetter_messageRequestId_fkey" FOREIGN KEY ("messageRequestId") REFERENCES "MessageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

