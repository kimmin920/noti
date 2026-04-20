CREATE TYPE "LoginProvider" AS ENUM ('GOOGLE_OAUTH', 'PUBL_SSO', 'LOCAL_PASSWORD');

ALTER TABLE "AdminUser"
ADD COLUMN "loginProvider" "LoginProvider" NOT NULL DEFAULT 'PUBL_SSO';

UPDATE "AdminUser"
SET "loginProvider" = CASE
  WHEN "providerUserId" LIKE 'google:%' THEN 'GOOGLE_OAUTH'::"LoginProvider"
  WHEN "providerUserId" LIKE 'local:%' THEN 'LOCAL_PASSWORD'::"LoginProvider"
  ELSE 'PUBL_SSO'::"LoginProvider"
END;
