ALTER TABLE "AdminUser"
  ADD COLUMN IF NOT EXISTS "autoRechargeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lowBalanceAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dailySendLimit" INTEGER NOT NULL DEFAULT 1000;

UPDATE "AdminUser" AS user_row
SET
  "autoRechargeEnabled" = COALESCE(setting."autoRechargeEnabled", user_row."autoRechargeEnabled"),
  "lowBalanceAlertEnabled" = COALESCE(setting."lowBalanceAlertEnabled", user_row."lowBalanceAlertEnabled"),
  "dailySendLimit" = COALESCE(setting."dailySendLimit", user_row."dailySendLimit"),
  "monthlySmsLimit" = COALESCE(setting."monthlySmsLimit", user_row."monthlySmsLimit")
FROM "TenantDashboardSetting" AS setting
WHERE setting."tenantId" = user_row."tenantId";

ALTER TABLE "AdminUser" DROP CONSTRAINT IF EXISTS "AdminUser_tenantId_fkey";
ALTER TABLE "BulkAlimtalkCampaign" DROP CONSTRAINT IF EXISTS "BulkAlimtalkCampaign_tenantId_fkey";
ALTER TABLE "BulkBrandMessageCampaign" DROP CONSTRAINT IF EXISTS "BulkBrandMessageCampaign_tenantId_fkey";
ALTER TABLE "BulkSmsCampaign" DROP CONSTRAINT IF EXISTS "BulkSmsCampaign_tenantId_fkey";
ALTER TABLE "EventRule" DROP CONSTRAINT IF EXISTS "EventRule_tenantId_fkey";
ALTER TABLE "ManagedUser" DROP CONSTRAINT IF EXISTS "ManagedUser_tenantId_fkey";
ALTER TABLE "ManagedUserField" DROP CONSTRAINT IF EXISTS "ManagedUserField_tenantId_fkey";
ALTER TABLE "MessageRequest" DROP CONSTRAINT IF EXISTS "MessageRequest_tenantId_fkey";
ALTER TABLE "ProviderTemplate" DROP CONSTRAINT IF EXISTS "ProviderTemplate_tenantId_fkey";
ALTER TABLE "SenderNumber" DROP CONSTRAINT IF EXISTS "SenderNumber_tenantId_fkey";
ALTER TABLE "SenderProfile" DROP CONSTRAINT IF EXISTS "SenderProfile_tenantId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_tenantId_fkey";
ALTER TABLE "SmsUsageLedger" DROP CONSTRAINT IF EXISTS "SmsUsageLedger_adminUserId_fkey";
ALTER TABLE "SmsUsageLedger" DROP CONSTRAINT IF EXISTS "SmsUsageLedger_tenantId_fkey";
ALTER TABLE "Template" DROP CONSTRAINT IF EXISTS "Template_tenantId_fkey";
ALTER TABLE "TenantDashboardSetting" DROP CONSTRAINT IF EXISTS "TenantDashboardSetting_tenantId_fkey";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ManagedUserField'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "ManagedUserField" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ManagedUser'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "ManagedUser" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'EventRule'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "EventRule" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Template'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "Template" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProviderTemplate'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "ProviderTemplate" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SenderNumber'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "SenderNumber" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SenderProfile'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "SenderProfile" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'MessageRequest'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "MessageRequest" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BulkSmsCampaign'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "BulkSmsCampaign" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BulkAlimtalkCampaign'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "BulkAlimtalkCampaign" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BulkBrandMessageCampaign'
      AND column_name = 'ownerAdminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "BulkBrandMessageCampaign" RENAME COLUMN "ownerAdminUserId" TO "ownerUserId"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SmsUsageLedger'
      AND column_name = 'adminUserId'
  ) THEN
    EXECUTE 'ALTER TABLE "SmsUsageLedger" RENAME COLUMN "adminUserId" TO "ownerUserId"';
  END IF;
END $$;

DROP INDEX IF EXISTS "AdminUser_tenantId_providerUserId_key";
DROP INDEX IF EXISTS "BulkAlimtalkCampaign_tenantId_ownerAdminUserId_createdAt_idx";
DROP INDEX IF EXISTS "BulkAlimtalkCampaign_tenantId_scheduledAt_idx";
DROP INDEX IF EXISTS "BulkBrandMessageCampaign_tenantId_ownerAdminUserId_createdAt_id";
DROP INDEX IF EXISTS "BulkSmsCampaign_tenantId_ownerAdminUserId_createdAt_idx";
DROP INDEX IF EXISTS "BulkSmsCampaign_tenantId_scheduledAt_idx";
DROP INDEX IF EXISTS "EventRule_tenantId_eventKey_key";
DROP INDEX IF EXISTS "EventRule_tenantId_ownerAdminUserId_updatedAt_idx";
DROP INDEX IF EXISTS "ManagedUser_tenantId_ownerAdminUserId_source_email_idx";
DROP INDEX IF EXISTS "ManagedUser_tenantId_ownerAdminUserId_source_externalId_key";
DROP INDEX IF EXISTS "ManagedUser_tenantId_ownerAdminUserId_source_phone_idx";
DROP INDEX IF EXISTS "ManagedUser_tenantId_ownerAdminUserId_updatedAt_idx";
DROP INDEX IF EXISTS "ManagedUserField_tenantId_ownerAdminUserId_createdAt_idx";
DROP INDEX IF EXISTS "ManagedUserField_tenantId_ownerAdminUserId_key_key";
DROP INDEX IF EXISTS "MessageRequest_status_scheduledAt_idx";
DROP INDEX IF EXISTS "MessageRequest_tenantId_idempotencyKey_key";
DROP INDEX IF EXISTS "MessageRequest_tenantId_ownerAdminUserId_createdAt_idx";
DROP INDEX IF EXISTS "MessageRequest_tenantId_ownerAdminUserId_eventKey_createdAt_idx";
DROP INDEX IF EXISTS "ProviderTemplate_tenantId_ownerAdminUserId_providerStatus_idx";
DROP INDEX IF EXISTS "SenderNumber_tenantId_ownerAdminUserId_phoneNumber_key";
DROP INDEX IF EXISTS "SenderNumber_tenantId_ownerAdminUserId_status_idx";
DROP INDEX IF EXISTS "SenderProfile_tenantId_ownerAdminUserId_senderKey_key";
DROP INDEX IF EXISTS "SenderProfile_tenantId_ownerAdminUserId_status_idx";
DROP INDEX IF EXISTS "SmsUsageLedger_adminUserId_usageAt_idx";
DROP INDEX IF EXISTS "SmsUsageLedger_tenantId_usageAt_idx";
DROP INDEX IF EXISTS "Template_tenantId_ownerAdminUserId_channel_updatedAt_idx";

ALTER TABLE "AdminUser" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "BulkAlimtalkCampaign" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "BulkBrandMessageCampaign" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "BulkSmsCampaign" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "EventRule" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "ManagedUser" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "ManagedUserField" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "MessageRequest" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "ProviderTemplate" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "SenderNumber" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "SenderProfile" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "SmsUsageLedger" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Template" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "WebhookEvent" DROP COLUMN IF EXISTS "tenantId";

ALTER TABLE "ManagedUserField" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "ManagedUser" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "EventRule" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "Template" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "ProviderTemplate" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "SenderNumber" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "SenderProfile" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "MessageRequest" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "BulkSmsCampaign" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "BulkAlimtalkCampaign" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "BulkBrandMessageCampaign" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "SmsUsageLedger" ALTER COLUMN "ownerUserId" SET NOT NULL;

DROP TABLE IF EXISTS "TenantDashboardSetting";
DROP TABLE IF EXISTS "Tenant";
DROP TYPE IF EXISTS "TenantStatus";

CREATE INDEX IF NOT EXISTS "BulkAlimtalkCampaign_ownerUserId_createdAt_idx" ON "BulkAlimtalkCampaign"("ownerUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BulkBrandMessageCampaign_ownerUserId_createdAt_idx" ON "BulkBrandMessageCampaign"("ownerUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BulkSmsCampaign_ownerUserId_createdAt_idx" ON "BulkSmsCampaign"("ownerUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EventRule_ownerUserId_updatedAt_idx" ON "EventRule"("ownerUserId", "updatedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "EventRule_ownerUserId_eventKey_key" ON "EventRule"("ownerUserId", "eventKey");
CREATE INDEX IF NOT EXISTS "ManagedUser_ownerUserId_updatedAt_idx" ON "ManagedUser"("ownerUserId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ManagedUser_ownerUserId_source_email_idx" ON "ManagedUser"("ownerUserId", "source", "email");
CREATE INDEX IF NOT EXISTS "ManagedUser_ownerUserId_source_phone_idx" ON "ManagedUser"("ownerUserId", "source", "phone");
CREATE UNIQUE INDEX IF NOT EXISTS "ManagedUser_ownerUserId_source_externalId_key" ON "ManagedUser"("ownerUserId", "source", "externalId");
CREATE INDEX IF NOT EXISTS "ManagedUserField_ownerUserId_createdAt_idx" ON "ManagedUserField"("ownerUserId", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "ManagedUserField_ownerUserId_key_key" ON "ManagedUserField"("ownerUserId", "key");
CREATE INDEX IF NOT EXISTS "MessageRequest_ownerUserId_createdAt_idx" ON "MessageRequest"("ownerUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MessageRequest_ownerUserId_eventKey_createdAt_idx" ON "MessageRequest"("ownerUserId", "eventKey", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "MessageRequest_ownerUserId_idempotencyKey_key" ON "MessageRequest"("ownerUserId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "ProviderTemplate_ownerUserId_providerStatus_idx" ON "ProviderTemplate"("ownerUserId", "providerStatus");
CREATE INDEX IF NOT EXISTS "SenderNumber_ownerUserId_status_idx" ON "SenderNumber"("ownerUserId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "SenderNumber_ownerUserId_phoneNumber_key" ON "SenderNumber"("ownerUserId", "phoneNumber");
CREATE INDEX IF NOT EXISTS "SenderProfile_ownerUserId_status_idx" ON "SenderProfile"("ownerUserId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "SenderProfile_ownerUserId_senderKey_key" ON "SenderProfile"("ownerUserId", "senderKey");
CREATE INDEX IF NOT EXISTS "SmsUsageLedger_ownerUserId_usageAt_idx" ON "SmsUsageLedger"("ownerUserId", "usageAt" DESC);
CREATE INDEX IF NOT EXISTS "Template_ownerUserId_channel_updatedAt_idx" ON "Template"("ownerUserId", "channel", "updatedAt" DESC);

ALTER TABLE "SmsUsageLedger"
  ADD CONSTRAINT "SmsUsageLedger_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
