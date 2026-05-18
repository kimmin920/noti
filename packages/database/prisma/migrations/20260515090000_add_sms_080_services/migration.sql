-- CreateEnum
CREATE TYPE "Sms080ServiceType" AS ENUM ('NHN_MANAGED', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "Sms080ServiceStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Sms080Service" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" "Sms080ServiceType" NOT NULL,
    "status" "Sms080ServiceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "unsubscribeNumber" TEXT,
    "businessName" TEXT NOT NULL,
    "providerName" TEXT,
    "reviewMemo" TEXT,
    "reviewedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sms080Service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sms080Service_ownerUserId_unsubscribeNumber_key" ON "Sms080Service"("ownerUserId", "unsubscribeNumber");

-- CreateIndex
CREATE INDEX "Sms080Service_ownerUserId_status_idx" ON "Sms080Service"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "Sms080Service_status_createdAt_idx" ON "Sms080Service"("status", "createdAt");
