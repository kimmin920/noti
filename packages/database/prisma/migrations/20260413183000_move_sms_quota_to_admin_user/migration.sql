-- Add account-based monthly quota
ALTER TABLE "AdminUser"
ADD COLUMN "monthlySmsLimit" INTEGER NOT NULL DEFAULT 1000;

UPDATE "AdminUser" AS u
SET "monthlySmsLimit" = COALESCE(tds."monthlySmsLimit", 1000)
FROM "TenantDashboardSetting" AS tds
WHERE tds."tenantId" = u."tenantId";

-- Move SMS usage ledger ownership from tenant bucket to account bucket
ALTER TABLE "SmsUsageLedger"
ADD COLUMN "adminUserId" TEXT;

UPDATE "SmsUsageLedger" AS l
SET "adminUserId" = mr."ownerAdminUserId"
FROM "MessageRequest" AS mr
WHERE l."messageRequestId" = mr."id"
  AND mr."ownerAdminUserId" IS NOT NULL;

UPDATE "SmsUsageLedger" AS l
SET "adminUserId" = bc."ownerAdminUserId"
FROM "BulkSmsCampaign" AS bc
WHERE l."bulkSmsCampaignId" = bc."id"
  AND l."adminUserId" IS NULL
  AND bc."ownerAdminUserId" IS NOT NULL;

UPDATE "SmsUsageLedger" AS l
SET "adminUserId" = sn."ownerAdminUserId"
FROM "SenderNumber" AS sn
WHERE l."senderNumberId" = sn."id"
  AND l."adminUserId" IS NULL
  AND sn."ownerAdminUserId" IS NOT NULL;

UPDATE "SmsUsageLedger" AS l
SET "adminUserId" = (
  SELECT u."id"
  FROM "AdminUser" AS u
  WHERE u."tenantId" = l."tenantId"
  ORDER BY CASE WHEN u."role" = 'SUPER_ADMIN' THEN 1 ELSE 0 END ASC, u."createdAt" ASC
  LIMIT 1
)
WHERE l."adminUserId" IS NULL;

ALTER TABLE "SmsUsageLedger"
ALTER COLUMN "adminUserId" SET NOT NULL;

CREATE INDEX "SmsUsageLedger_adminUserId_usageAt_idx" ON "SmsUsageLedger"("adminUserId", "usageAt" DESC);

ALTER TABLE "SmsUsageLedger"
ADD CONSTRAINT "SmsUsageLedger_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
