-- AlterTable
ALTER TABLE "TenantDashboardSetting"
ADD COLUMN "monthlySmsLimit" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "SmsUsageLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderNumberId" TEXT,
    "messageRequestId" TEXT,
    "bulkSmsCampaignId" TEXT,
    "quantity" INTEGER NOT NULL,
    "usageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsUsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsUsageLedger_messageRequestId_key" ON "SmsUsageLedger"("messageRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsUsageLedger_bulkSmsCampaignId_key" ON "SmsUsageLedger"("bulkSmsCampaignId");

-- CreateIndex
CREATE INDEX "SmsUsageLedger_tenantId_usageAt_idx" ON "SmsUsageLedger"("tenantId", "usageAt" DESC);

-- CreateIndex
CREATE INDEX "SmsUsageLedger_senderNumberId_usageAt_idx" ON "SmsUsageLedger"("senderNumberId", "usageAt" DESC);

-- AddForeignKey
ALTER TABLE "SmsUsageLedger" ADD CONSTRAINT "SmsUsageLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsUsageLedger" ADD CONSTRAINT "SmsUsageLedger_senderNumberId_fkey" FOREIGN KEY ("senderNumberId") REFERENCES "SenderNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsUsageLedger" ADD CONSTRAINT "SmsUsageLedger_messageRequestId_fkey" FOREIGN KEY ("messageRequestId") REFERENCES "MessageRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsUsageLedger" ADD CONSTRAINT "SmsUsageLedger_bulkSmsCampaignId_fkey" FOREIGN KEY ("bulkSmsCampaignId") REFERENCES "BulkSmsCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
