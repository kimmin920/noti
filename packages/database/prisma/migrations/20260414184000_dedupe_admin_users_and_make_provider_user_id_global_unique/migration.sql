CREATE TEMP TABLE migration_ranked_users AS
SELECT
  au."id" AS user_id,
  au."providerUserId" AS provider_user_id,
  au."tenantId" AS previous_account_id,
  au."email" AS email,
  au."role" AS role,
  au."accessOrigin" AS access_origin,
  au."createdAt" AS created_at,
  ROW_NUMBER() OVER (
    PARTITION BY au."providerUserId"
    ORDER BY
      CASE au."role"
        WHEN 'SUPER_ADMIN' THEN 3
        WHEN 'PARTNER_ADMIN' THEN 2
        ELSE 1
      END DESC,
      CASE au."accessOrigin"
        WHEN 'PUBL' THEN 1
        ELSE 0
      END DESC,
      au."createdAt" DESC,
      au."id" DESC
  ) AS provider_rank
FROM "AdminUser" au;

CREATE TEMP TABLE migration_canonical_users AS
SELECT
  ranked.user_id,
  ranked.provider_user_id,
  ranked.previous_account_id,
  ranked.email,
  ranked.role,
  ranked.access_origin,
  ('user:' || ranked.provider_user_id) AS target_account_id
FROM migration_ranked_users ranked
WHERE ranked.provider_rank = 1;

CREATE TEMP TABLE migration_duplicate_users AS
SELECT
  ranked.user_id,
  canonical.user_id AS canonical_user_id,
  ranked.provider_user_id
FROM migration_ranked_users ranked
JOIN migration_canonical_users canonical
  ON canonical.provider_user_id = ranked.provider_user_id
WHERE ranked.provider_rank > 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "ManagedUserField" f ON f."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "ManagedUser" u ON u."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "EventRule" e ON e."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "Template" t ON t."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "ProviderTemplate" pt ON pt."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "SenderNumber" sn ON sn."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "SenderProfile" sp ON sp."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "MessageRequest" mr ON mr."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "BulkSmsCampaign" bsc ON bsc."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "BulkAlimtalkCampaign" bac ON bac."ownerAdminUserId" = dup.user_id
    UNION ALL
    SELECT 1
    FROM migration_duplicate_users dup
    JOIN "BulkBrandMessageCampaign" bbc ON bbc."ownerAdminUserId" = dup.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot dedupe duplicate users because legacy owned resources still exist on duplicate accounts.';
  END IF;
END $$;

UPDATE "Session" session
SET
  "userId" = dup.canonical_user_id
FROM migration_duplicate_users dup
WHERE session."userId" = dup.user_id;

UPDATE "SmsUsageLedger" ledger
SET
  "adminUserId" = dup.canonical_user_id
FROM migration_duplicate_users dup
WHERE ledger."adminUserId" = dup.user_id;

DELETE FROM "AdminUser" user_row
USING migration_duplicate_users dup
WHERE user_row."id" = dup.user_id;

CREATE TEMP TABLE migration_target_accounts AS
SELECT
  canonical.user_id,
  canonical.provider_user_id,
  canonical.previous_account_id,
  canonical.target_account_id,
  canonical.access_origin,
  COALESCE(
    NULLIF(canonical.email, ''),
    previous_account."name",
    CASE canonical.access_origin
      WHEN 'PUBL' THEN 'PUBL ' || canonical.provider_user_id
      ELSE 'User ' || canonical.provider_user_id
    END
  ) AS target_account_name,
  COALESCE(setting."autoRechargeEnabled", false) AS auto_recharge_enabled,
  COALESCE(setting."lowBalanceAlertEnabled", false) AS low_balance_alert_enabled,
  COALESCE(setting."dailySendLimit", 1000) AS daily_send_limit,
  COALESCE(setting."monthlySmsLimit", 1000) AS monthly_sms_limit
FROM migration_canonical_users canonical
LEFT JOIN "Tenant" previous_account
  ON previous_account."id" = canonical.previous_account_id
LEFT JOIN "TenantDashboardSetting" setting
  ON setting."tenantId" = canonical.previous_account_id;

INSERT INTO "Tenant" (
  "id",
  "name",
  "status",
  "accessOrigin",
  "createdAt",
  "updatedAt"
)
SELECT
  target.target_account_id,
  target.target_account_name,
  'ACTIVE'::"TenantStatus",
  target.access_origin,
  NOW(),
  NOW()
FROM migration_target_accounts target
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "accessOrigin" = EXCLUDED."accessOrigin",
  "updatedAt" = NOW();

INSERT INTO "TenantDashboardSetting" (
  "id",
  "tenantId",
  "autoRechargeEnabled",
  "lowBalanceAlertEnabled",
  "dailySendLimit",
  "monthlySmsLimit",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('tenant-dashboard-setting:' || target.target_account_id),
  target.target_account_id,
  target.auto_recharge_enabled,
  target.low_balance_alert_enabled,
  target.daily_send_limit,
  target.monthly_sms_limit,
  NOW(),
  NOW()
FROM migration_target_accounts target
ON CONFLICT ("tenantId") DO UPDATE
SET
  "autoRechargeEnabled" = EXCLUDED."autoRechargeEnabled",
  "lowBalanceAlertEnabled" = EXCLUDED."lowBalanceAlertEnabled",
  "dailySendLimit" = EXCLUDED."dailySendLimit",
  "monthlySmsLimit" = EXCLUDED."monthlySmsLimit",
  "updatedAt" = NOW();

UPDATE "AdminUser" user_row
SET
  "tenantId" = target.target_account_id
FROM migration_target_accounts target
WHERE user_row."id" = target.user_id;

UPDATE "ManagedUserField" field_row
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE field_row."ownerAdminUserId" = user_row."id";

UPDATE "ManagedUser" managed_user
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE managed_user."ownerAdminUserId" = user_row."id";

UPDATE "EventRule" event_rule
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE event_rule."ownerAdminUserId" = user_row."id";

UPDATE "Template" template_row
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE template_row."ownerAdminUserId" = user_row."id";

UPDATE "ProviderTemplate" provider_template
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE provider_template."ownerAdminUserId" = user_row."id";

UPDATE "SenderNumber" sender_number
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE sender_number."ownerAdminUserId" = user_row."id";

UPDATE "SenderProfile" sender_profile
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE sender_profile."ownerAdminUserId" = user_row."id";

UPDATE "MessageRequest" message_request
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE message_request."ownerAdminUserId" = user_row."id";

UPDATE "BulkSmsCampaign" bulk_sms
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE bulk_sms."ownerAdminUserId" = user_row."id";

UPDATE "BulkAlimtalkCampaign" bulk_alimtalk
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE bulk_alimtalk."ownerAdminUserId" = user_row."id";

UPDATE "BulkBrandMessageCampaign" bulk_brand
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE bulk_brand."ownerAdminUserId" = user_row."id";

UPDATE "Session" session_row
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE session_row."userId" = user_row."id";

UPDATE "SmsUsageLedger" ledger
SET
  "tenantId" = 'user:' || user_row."providerUserId"
FROM "AdminUser" user_row
WHERE ledger."adminUserId" = user_row."id";

ALTER TABLE "AdminUser"
DROP CONSTRAINT IF EXISTS "AdminUser_tenantId_providerUserId_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminUser_providerUserId_key'
  ) THEN
    ALTER TABLE "AdminUser"
    ADD CONSTRAINT "AdminUser_providerUserId_key" UNIQUE ("providerUserId");
  END IF;
END $$;

DELETE FROM "Tenant" tenant_row
WHERE NOT EXISTS (
  SELECT 1
  FROM "AdminUser" user_row
  WHERE user_row."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "Session" session_row
  WHERE session_row."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "ManagedUserField" field_row
  WHERE field_row."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "ManagedUser" managed_user
  WHERE managed_user."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "EventRule" event_rule
  WHERE event_rule."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "Template" template_row
  WHERE template_row."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "ProviderTemplate" provider_template
  WHERE provider_template."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "SenderNumber" sender_number
  WHERE sender_number."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "SenderProfile" sender_profile
  WHERE sender_profile."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "MessageRequest" message_request
  WHERE message_request."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "BulkSmsCampaign" bulk_sms
  WHERE bulk_sms."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "BulkAlimtalkCampaign" bulk_alimtalk
  WHERE bulk_alimtalk."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "BulkBrandMessageCampaign" bulk_brand
  WHERE bulk_brand."tenantId" = tenant_row."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "SmsUsageLedger" ledger
  WHERE ledger."tenantId" = tenant_row."id"
);
