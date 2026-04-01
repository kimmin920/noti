CREATE TYPE "AccessOrigin" AS ENUM ('DIRECT', 'PUBL');

CREATE TYPE "UserRole_new" AS ENUM ('TENANT_ADMIN', 'PARTNER_ADMIN', 'SUPER_ADMIN');

ALTER TABLE "Tenant"
  ADD COLUMN "accessOrigin" "AccessOrigin" NOT NULL DEFAULT 'DIRECT';

ALTER TABLE "AdminUser"
  ADD COLUMN "accessOrigin" "AccessOrigin" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "partnerScope" "AccessOrigin";

ALTER TABLE "AdminUser"
  ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "AdminUser"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text = 'TENANT_ADMIN' THEN 'TENANT_ADMIN'::"UserRole_new"
      WHEN "role"::text = 'OPERATOR' THEN 'SUPER_ADMIN'::"UserRole_new"
      ELSE 'TENANT_ADMIN'::"UserRole_new"
    END
  );

DROP TYPE "UserRole";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "AdminUser"
  ALTER COLUMN "role" SET DEFAULT 'TENANT_ADMIN';
