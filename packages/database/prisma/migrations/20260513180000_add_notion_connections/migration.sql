-- CreateTable
CREATE TABLE "NotionConnection" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceName" TEXT,
    "workspaceIcon" TEXT,
    "botId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "selectedDataSourceId" TEXT,
    "selectedDataSourceName" TEXT,
    "selectedDataSourceUrl" TEXT,
    "selectedMappings" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotionConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotionConnection_ownerUserId_workspaceId_key" ON "NotionConnection"("ownerUserId", "workspaceId");

-- CreateIndex
CREATE INDEX "NotionConnection_ownerUserId_updatedAt_idx" ON "NotionConnection"("ownerUserId", "updatedAt" DESC);
