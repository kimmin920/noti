ALTER TABLE "MessageRequest" ADD COLUMN "retryOfRequestId" TEXT;

ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_retryOfRequestId_fkey" FOREIGN KEY ("retryOfRequestId") REFERENCES "MessageRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MessageRequest_ownerUserId_retryOfRequestId_createdAt_idx" ON "MessageRequest"("ownerUserId", "retryOfRequestId", "createdAt" DESC);
