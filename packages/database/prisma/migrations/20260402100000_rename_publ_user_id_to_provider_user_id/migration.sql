ALTER TABLE "AdminUser"
RENAME COLUMN "publUserId" TO "providerUserId";

ALTER INDEX "AdminUser_tenantId_publUserId_key"
RENAME TO "AdminUser_tenantId_providerUserId_key";
