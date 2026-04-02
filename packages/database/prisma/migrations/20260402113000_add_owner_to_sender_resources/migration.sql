ALTER TABLE "SenderNumber"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "SenderProfile"
ADD COLUMN "ownerAdminUserId" TEXT;

UPDATE "SenderNumber" AS sn
SET "ownerAdminUserId" = owner_map."adminUserId"
FROM (
  SELECT
    au."tenantId",
    MIN(au.id) AS "adminUserId"
  FROM "AdminUser" AS au
  GROUP BY au."tenantId"
  HAVING COUNT(*) = 1
) AS owner_map
WHERE sn."tenantId" = owner_map."tenantId"
  AND sn."ownerAdminUserId" IS NULL;

UPDATE "SenderProfile" AS sp
SET "ownerAdminUserId" = owner_map."adminUserId"
FROM (
  SELECT
    au."tenantId",
    MIN(au.id) AS "adminUserId"
  FROM "AdminUser" AS au
  GROUP BY au."tenantId"
  HAVING COUNT(*) = 1
) AS owner_map
WHERE sp."tenantId" = owner_map."tenantId"
  AND sp."ownerAdminUserId" IS NULL;

DROP INDEX "SenderNumber_tenantId_phoneNumber_key";
CREATE UNIQUE INDEX "SenderNumber_tenantId_ownerAdminUserId_phoneNumber_key"
ON "SenderNumber"("tenantId", "ownerAdminUserId", "phoneNumber");

DROP INDEX "SenderProfile_tenantId_senderKey_key";
CREATE UNIQUE INDEX "SenderProfile_tenantId_ownerAdminUserId_senderKey_key"
ON "SenderProfile"("tenantId", "ownerAdminUserId", "senderKey");

CREATE INDEX "SenderNumber_tenantId_ownerAdminUserId_status_idx"
ON "SenderNumber"("tenantId", "ownerAdminUserId", "status");

CREATE INDEX "SenderProfile_tenantId_ownerAdminUserId_status_idx"
ON "SenderProfile"("tenantId", "ownerAdminUserId", "status");
