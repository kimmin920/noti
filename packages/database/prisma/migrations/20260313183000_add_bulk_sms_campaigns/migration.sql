CREATE TYPE "BulkSmsCampaignStatus" AS ENUM ('PROCESSING', 'SENT_TO_PROVIDER', 'PARTIAL_FAILED', 'FAILED');

CREATE TYPE "BulkSmsRecipientStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'FAILED');

CREATE TABLE "BulkSmsCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "BulkSmsCampaignStatus" NOT NULL DEFAULT 'PROCESSING',
    "senderNumberId" TEXT NOT NULL,
    "templateId" TEXT,
    "body" TEXT NOT NULL,
    "nhnRequestId" TEXT,
    "totalRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedNoPhoneCount" INTEGER NOT NULL DEFAULT 0,
    "duplicatePhoneCount" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT,
    "providerRequest" JSONB,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkSmsCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BulkSmsRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "managedUserId" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientSeq" TEXT,
    "recipientGroupingKey" TEXT,
    "status" "BulkSmsRecipientStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerResultCode" TEXT,
    "providerResultMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkSmsRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulkSmsCampaign_tenantId_createdAt_idx" ON "BulkSmsCampaign"("tenantId", "createdAt" DESC);
CREATE INDEX "BulkSmsRecipient_campaignId_createdAt_idx" ON "BulkSmsRecipient"("campaignId", "createdAt" ASC);
CREATE INDEX "BulkSmsRecipient_managedUserId_idx" ON "BulkSmsRecipient"("managedUserId");

ALTER TABLE "BulkSmsCampaign"
ADD CONSTRAINT "BulkSmsCampaign_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulkSmsCampaign"
ADD CONSTRAINT "BulkSmsCampaign_senderNumberId_fkey"
FOREIGN KEY ("senderNumberId") REFERENCES "SenderNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BulkSmsCampaign"
ADD CONSTRAINT "BulkSmsCampaign_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BulkSmsRecipient"
ADD CONSTRAINT "BulkSmsRecipient_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "BulkSmsCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulkSmsRecipient"
ADD CONSTRAINT "BulkSmsRecipient_managedUserId_fkey"
FOREIGN KEY ("managedUserId") REFERENCES "ManagedUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
