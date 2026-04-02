ALTER TABLE "ManagedUserField"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "ManagedUser"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "EventRule"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "Template"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "ProviderTemplate"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "MessageRequest"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "BulkSmsCampaign"
ADD COLUMN "ownerAdminUserId" TEXT;

ALTER TABLE "BulkAlimtalkCampaign"
ADD COLUMN "ownerAdminUserId" TEXT;

UPDATE "ManagedUserField" AS muf
SET "ownerAdminUserId" = owner_map."adminUserId"
FROM (
  SELECT
    au."tenantId",
    MIN(au.id) AS "adminUserId"
  FROM "AdminUser" AS au
  GROUP BY au."tenantId"
  HAVING COUNT(*) = 1
) AS owner_map
WHERE muf."tenantId" = owner_map."tenantId"
  AND muf."ownerAdminUserId" IS NULL;

UPDATE "ManagedUser" AS mu
SET "ownerAdminUserId" = owner_map."adminUserId"
FROM (
  SELECT
    au."tenantId",
    MIN(au.id) AS "adminUserId"
  FROM "AdminUser" AS au
  GROUP BY au."tenantId"
  HAVING COUNT(*) = 1
) AS owner_map
WHERE mu."tenantId" = owner_map."tenantId"
  AND mu."ownerAdminUserId" IS NULL;

UPDATE "EventRule"
SET "ownerAdminUserId" = "updatedBy"
WHERE "updatedBy" IS NOT NULL
  AND "ownerAdminUserId" IS NULL;

UPDATE "EventRule" AS er
SET "ownerAdminUserId" = owner_map."adminUserId"
FROM (
  SELECT
    au."tenantId",
    MIN(au.id) AS "adminUserId"
  FROM "AdminUser" AS au
  GROUP BY au."tenantId"
  HAVING COUNT(*) = 1
) AS owner_map
WHERE er."tenantId" = owner_map."tenantId"
  AND er."ownerAdminUserId" IS NULL;

UPDATE "Template"
SET "ownerAdminUserId" = template_owner."createdBy"
FROM (
  SELECT DISTINCT ON (tv."templateId")
    tv."templateId",
    tv."createdBy"
  FROM "TemplateVersion" AS tv
  WHERE tv."createdBy" IS NOT NULL
  ORDER BY tv."templateId", tv.version ASC
) AS template_owner
WHERE "Template".id = template_owner."templateId"
  AND "Template"."ownerAdminUserId" IS NULL;

UPDATE "Template" AS t
SET "ownerAdminUserId" = owner_map."adminUserId"
FROM (
  SELECT
    au."tenantId",
    MIN(au.id) AS "adminUserId"
  FROM "AdminUser" AS au
  GROUP BY au."tenantId"
  HAVING COUNT(*) = 1
) AS owner_map
WHERE t."tenantId" = owner_map."tenantId"
  AND t."ownerAdminUserId" IS NULL;

UPDATE "ProviderTemplate" AS pt
SET "ownerAdminUserId" = t."ownerAdminUserId"
FROM "Template" AS t
WHERE pt."templateId" = t.id
  AND pt."ownerAdminUserId" IS NULL;

UPDATE "ProviderTemplate" AS pt
SET "ownerAdminUserId" = owner_map."adminUserId"
FROM (
  SELECT
    au."tenantId",
    MIN(au.id) AS "adminUserId"
  FROM "AdminUser" AS au
  GROUP BY au."tenantId"
  HAVING COUNT(*) = 1
) AS owner_map
WHERE pt."tenantId" = owner_map."tenantId"
  AND pt."ownerAdminUserId" IS NULL;

UPDATE "MessageRequest"
SET "ownerAdminUserId" = "metadataJson"->>'initiatedBy'
WHERE "ownerAdminUserId" IS NULL
  AND "metadataJson" IS NOT NULL
  AND COALESCE("metadataJson"->>'initiatedBy', '') <> '';

UPDATE "MessageRequest" AS mr
SET "ownerAdminUserId" = er."ownerAdminUserId"
FROM "EventRule" AS er
WHERE mr."tenantId" = er."tenantId"
  AND mr."eventKey" = er."eventKey"
  AND mr."ownerAdminUserId" IS NULL
  AND er."ownerAdminUserId" IS NOT NULL;

UPDATE "BulkSmsCampaign"
SET "ownerAdminUserId" = "requestedBy"
WHERE "ownerAdminUserId" IS NULL
  AND "requestedBy" IS NOT NULL;

UPDATE "BulkAlimtalkCampaign"
SET "ownerAdminUserId" = "requestedBy"
WHERE "ownerAdminUserId" IS NULL
  AND "requestedBy" IS NOT NULL;

DROP INDEX "ManagedUserField_tenantId_key_key";
CREATE UNIQUE INDEX "ManagedUserField_tenantId_ownerAdminUserId_key_key"
ON "ManagedUserField"("tenantId", "ownerAdminUserId", "key");

DROP INDEX "ManagedUserField_tenantId_createdAt_idx";
CREATE INDEX "ManagedUserField_tenantId_ownerAdminUserId_createdAt_idx"
ON "ManagedUserField"("tenantId", "ownerAdminUserId", "createdAt" DESC);

DROP INDEX "ManagedUser_tenantId_source_externalId_key";
CREATE UNIQUE INDEX "ManagedUser_tenantId_ownerAdminUserId_source_externalId_key"
ON "ManagedUser"("tenantId", "ownerAdminUserId", "source", "externalId");

DROP INDEX "ManagedUser_tenantId_updatedAt_idx";
CREATE INDEX "ManagedUser_tenantId_ownerAdminUserId_updatedAt_idx"
ON "ManagedUser"("tenantId", "ownerAdminUserId", "updatedAt" DESC);

DROP INDEX "ManagedUser_tenantId_source_email_idx";
CREATE INDEX "ManagedUser_tenantId_ownerAdminUserId_source_email_idx"
ON "ManagedUser"("tenantId", "ownerAdminUserId", "source", "email");

DROP INDEX "ManagedUser_tenantId_source_phone_idx";
CREATE INDEX "ManagedUser_tenantId_ownerAdminUserId_source_phone_idx"
ON "ManagedUser"("tenantId", "ownerAdminUserId", "source", "phone");

CREATE INDEX "EventRule_tenantId_ownerAdminUserId_updatedAt_idx"
ON "EventRule"("tenantId", "ownerAdminUserId", "updatedAt" DESC);

CREATE INDEX "Template_tenantId_ownerAdminUserId_channel_updatedAt_idx"
ON "Template"("tenantId", "ownerAdminUserId", "channel", "updatedAt" DESC);

DROP INDEX "ProviderTemplate_tenantId_providerStatus_idx";
CREATE INDEX "ProviderTemplate_tenantId_ownerAdminUserId_providerStatus_idx"
ON "ProviderTemplate"("tenantId", "ownerAdminUserId", "providerStatus");

DROP INDEX "MessageRequest_tenantId_createdAt_idx";
CREATE INDEX "MessageRequest_tenantId_ownerAdminUserId_createdAt_idx"
ON "MessageRequest"("tenantId", "ownerAdminUserId", "createdAt" DESC);

DROP INDEX "MessageRequest_tenantId_eventKey_createdAt_idx";
CREATE INDEX "MessageRequest_tenantId_ownerAdminUserId_eventKey_createdAt_idx"
ON "MessageRequest"("tenantId", "ownerAdminUserId", "eventKey", "createdAt" DESC);

DROP INDEX "BulkSmsCampaign_tenantId_createdAt_idx";
CREATE INDEX "BulkSmsCampaign_tenantId_ownerAdminUserId_createdAt_idx"
ON "BulkSmsCampaign"("tenantId", "ownerAdminUserId", "createdAt" DESC);

DROP INDEX "BulkAlimtalkCampaign_tenantId_createdAt_idx";
CREATE INDEX "BulkAlimtalkCampaign_tenantId_ownerAdminUserId_createdAt_idx"
ON "BulkAlimtalkCampaign"("tenantId", "ownerAdminUserId", "createdAt" DESC);
