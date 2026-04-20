ALTER TABLE "BulkBrandMessageCampaign"
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'FREESTYLE',
ADD COLUMN "templateName" TEXT,
ADD COLUMN "templateCode" TEXT;

ALTER TABLE "BulkBrandMessageRecipient"
ADD COLUMN "templateParameters" JSONB;
