ALTER TABLE "AdminUser"
ADD COLUMN "loginId" TEXT,
ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "AdminUser_loginId_key" ON "AdminUser"("loginId");
