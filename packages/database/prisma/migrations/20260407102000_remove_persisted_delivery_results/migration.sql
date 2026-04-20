-- Drop delivery result persistence for message requests
DROP TABLE IF EXISTS "DeliveryResult";

-- Remove persisted bulk campaign result aggregates
ALTER TABLE "BulkSmsCampaign"
  DROP COLUMN IF EXISTS "acceptedCount",
  DROP COLUMN IF EXISTS "failedCount";

ALTER TABLE "BulkAlimtalkCampaign"
  DROP COLUMN IF EXISTS "acceptedCount",
  DROP COLUMN IF EXISTS "failedCount";

ALTER TABLE "BulkBrandMessageCampaign"
  DROP COLUMN IF EXISTS "acceptedCount",
  DROP COLUMN IF EXISTS "failedCount";

-- Remove persisted recipient-level provider result copies
ALTER TABLE "BulkSmsRecipient"
  DROP COLUMN IF EXISTS "providerResultCode",
  DROP COLUMN IF EXISTS "providerResultMessage";

ALTER TABLE "BulkAlimtalkRecipient"
  DROP COLUMN IF EXISTS "providerResultCode",
  DROP COLUMN IF EXISTS "providerResultMessage";

ALTER TABLE "BulkBrandMessageRecipient"
  DROP COLUMN IF EXISTS "providerResultCode",
  DROP COLUMN IF EXISTS "providerResultMessage";
