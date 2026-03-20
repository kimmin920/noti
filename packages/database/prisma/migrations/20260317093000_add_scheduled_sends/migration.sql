ALTER TABLE "MessageRequest"
ADD COLUMN "scheduledAt" TIMESTAMP(3);

ALTER TABLE "BulkSmsCampaign"
ADD COLUMN "scheduledAt" TIMESTAMP(3);

ALTER TABLE "BulkSmsRecipient"
ADD COLUMN "templateParameters" JSONB;

ALTER TABLE "BulkAlimtalkCampaign"
ADD COLUMN "scheduledAt" TIMESTAMP(3);

ALTER TABLE "BulkAlimtalkRecipient"
ADD COLUMN "templateParameters" JSONB;

CREATE INDEX "MessageRequest_status_scheduledAt_idx"
ON "MessageRequest"("status", "scheduledAt");

CREATE INDEX "BulkSmsCampaign_tenantId_scheduledAt_idx"
ON "BulkSmsCampaign"("tenantId", "scheduledAt");

CREATE INDEX "BulkAlimtalkCampaign_tenantId_scheduledAt_idx"
ON "BulkAlimtalkCampaign"("tenantId", "scheduledAt");
