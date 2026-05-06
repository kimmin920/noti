CREATE TABLE "PublEventDefinition" (
    "id" TEXT NOT NULL,
    "catalogKey" TEXT,
    "eventKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pAppCode" TEXT,
    "pAppName" TEXT,
    "triggerText" TEXT,
    "detailText" TEXT,
    "serviceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "locationType" TEXT,
    "locationId" TEXT,
    "sourceType" TEXT,
    "actionType" TEXT,
    "docsVersion" TEXT,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublEventDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublEventPropDefinition" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rawPath" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sample" TEXT,
    "description" TEXT,
    "fallback" TEXT,
    "parserPipeline" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublEventPropDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublEventDefinition_catalogKey_key" ON "PublEventDefinition"("catalogKey");
CREATE UNIQUE INDEX "PublEventDefinition_eventKey_key" ON "PublEventDefinition"("eventKey");
CREATE INDEX "PublEventDefinition_serviceStatus_category_idx" ON "PublEventDefinition"("serviceStatus", "category");
CREATE INDEX "PublEventDefinition_updatedAt_idx" ON "PublEventDefinition"("updatedAt" DESC);
CREATE UNIQUE INDEX "PublEventPropDefinition_eventId_rawPath_key" ON "PublEventPropDefinition"("eventId", "rawPath");
CREATE INDEX "PublEventPropDefinition_eventId_sortOrder_idx" ON "PublEventPropDefinition"("eventId", "sortOrder");

ALTER TABLE "PublEventPropDefinition"
ADD CONSTRAINT "PublEventPropDefinition_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "PublEventDefinition"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
