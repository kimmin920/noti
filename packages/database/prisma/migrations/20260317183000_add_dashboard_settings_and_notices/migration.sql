CREATE TABLE "TenantDashboardSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "autoRechargeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lowBalanceAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDashboardSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DashboardNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdByEmail" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantDashboardSetting_tenantId_key" ON "TenantDashboardSetting"("tenantId");
CREATE INDEX "DashboardNotice_archivedAt_isPinned_createdAt_idx" ON "DashboardNotice"("archivedAt", "isPinned", "createdAt" DESC);

ALTER TABLE "TenantDashboardSetting"
ADD CONSTRAINT "TenantDashboardSetting_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
