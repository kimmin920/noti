CREATE TABLE "BulkAlimtalkCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "BulkSmsCampaignStatus" NOT NULL DEFAULT 'PROCESSING',
    "senderProfileId" TEXT NOT NULL,
    "providerTemplateId" TEXT NOT NULL,
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

    CONSTRAINT "BulkAlimtalkCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BulkAlimtalkRecipient" (
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

    CONSTRAINT "BulkAlimtalkRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulkAlimtalkCampaign_tenantId_createdAt_idx" ON "BulkAlimtalkCampaign"("tenantId", "createdAt" DESC);
CREATE INDEX "BulkAlimtalkRecipient_campaignId_createdAt_idx" ON "BulkAlimtalkRecipient"("campaignId", "createdAt" ASC);
CREATE INDEX "BulkAlimtalkRecipient_managedUserId_idx" ON "BulkAlimtalkRecipient"("managedUserId");

ALTER TABLE "BulkAlimtalkCampaign"
ADD CONSTRAINT "BulkAlimtalkCampaign_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulkAlimtalkCampaign"
ADD CONSTRAINT "BulkAlimtalkCampaign_senderProfileId_fkey"
FOREIGN KEY ("senderProfileId") REFERENCES "SenderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BulkAlimtalkCampaign"
ADD CONSTRAINT "BulkAlimtalkCampaign_providerTemplateId_fkey"
FOREIGN KEY ("providerTemplateId") REFERENCES "ProviderTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BulkAlimtalkRecipient"
ADD CONSTRAINT "BulkAlimtalkRecipient_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "BulkAlimtalkCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulkAlimtalkRecipient"
ADD CONSTRAINT "BulkAlimtalkRecipient_managedUserId_fkey"
FOREIGN KEY ("managedUserId") REFERENCES "ManagedUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
