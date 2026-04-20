INSERT INTO "SmsUsageLedger" (
  "id",
  "tenantId",
  "senderNumberId",
  "messageRequestId",
  "quantity",
  "usageAt",
  "createdAt"
)
SELECT
  'sms_usage_req_' || "id",
  "tenantId",
  "resolvedSenderNumberId",
  "id",
  1,
  COALESCE("scheduledAt", "createdAt"),
  "createdAt"
FROM "MessageRequest"
WHERE "resolvedChannel" = 'SMS'
  AND "status" <> 'CANCELED'
ON CONFLICT ("messageRequestId") DO NOTHING;

INSERT INTO "SmsUsageLedger" (
  "id",
  "tenantId",
  "senderNumberId",
  "bulkSmsCampaignId",
  "quantity",
  "usageAt",
  "createdAt"
)
SELECT
  'sms_usage_bulk_' || "id",
  "tenantId",
  "senderNumberId",
  "id",
  "totalRecipientCount",
  COALESCE("scheduledAt", "createdAt"),
  "createdAt"
FROM "BulkSmsCampaign"
WHERE "totalRecipientCount" > 0
ON CONFLICT ("bulkSmsCampaignId") DO NOTHING;
