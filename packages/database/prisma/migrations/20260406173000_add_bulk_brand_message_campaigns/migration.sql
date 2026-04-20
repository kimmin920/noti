-- CreateTable
CREATE TABLE "BulkBrandMessageCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerAdminUserId" TEXT,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "BulkSmsCampaignStatus" NOT NULL DEFAULT 'PROCESSING',
    "senderProfileId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pushAlarm" BOOLEAN NOT NULL DEFAULT true,
    "adult" BOOLEAN NOT NULL DEFAULT false,
    "statsEventKey" TEXT,
    "resellerCode" TEXT,
    "imageUrl" TEXT,
    "imageLink" TEXT,
    "buttonsJson" JSONB,
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

    CONSTRAINT "BulkBrandMessageCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkBrandMessageRecipient" (
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

    CONSTRAINT "BulkBrandMessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkBrandMessageCampaign_tenantId_ownerAdminUserId_createdAt_idx" ON "BulkBrandMessageCampaign"("tenantId", "ownerAdminUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BulkBrandMessageRecipient_campaignId_createdAt_idx" ON "BulkBrandMessageRecipient"("campaignId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "BulkBrandMessageRecipient_managedUserId_idx" ON "BulkBrandMessageRecipient"("managedUserId");

-- AddForeignKey
ALTER TABLE "BulkBrandMessageCampaign" ADD CONSTRAINT "BulkBrandMessageCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkBrandMessageCampaign" ADD CONSTRAINT "BulkBrandMessageCampaign_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "SenderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkBrandMessageRecipient" ADD CONSTRAINT "BulkBrandMessageRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BulkBrandMessageCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkBrandMessageRecipient" ADD CONSTRAINT "BulkBrandMessageRecipient_managedUserId_fkey" FOREIGN KEY ("managedUserId") REFERENCES "ManagedUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
