CREATE TYPE "ManagedUserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DORMANT', 'BLOCKED');

CREATE TYPE "ManagedUserFieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON');

CREATE TABLE "ManagedUserField" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" "ManagedUserFieldType" NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedUserField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagedUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "ManagedUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "userType" TEXT,
    "segment" TEXT,
    "gradeOrLevel" TEXT,
    "marketingConsent" BOOLEAN,
    "tags" JSONB,
    "registeredAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "customAttributes" JSONB,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedUserField_tenantId_key_key" ON "ManagedUserField"("tenantId", "key");
CREATE INDEX "ManagedUserField_tenantId_createdAt_idx" ON "ManagedUserField"("tenantId", "createdAt" DESC);

CREATE UNIQUE INDEX "ManagedUser_tenantId_source_externalId_key" ON "ManagedUser"("tenantId", "source", "externalId");
CREATE INDEX "ManagedUser_tenantId_updatedAt_idx" ON "ManagedUser"("tenantId", "updatedAt" DESC);
CREATE INDEX "ManagedUser_tenantId_source_email_idx" ON "ManagedUser"("tenantId", "source", "email");
CREATE INDEX "ManagedUser_tenantId_source_phone_idx" ON "ManagedUser"("tenantId", "source", "phone");

ALTER TABLE "ManagedUserField"
ADD CONSTRAINT "ManagedUserField_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagedUser"
ADD CONSTRAINT "ManagedUser_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
