ALTER TABLE "SenderProfile"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

WITH ranked_sender_profiles AS (
  SELECT
    "id",
       ROW_NUMBER() OVER (
         PARTITION BY "ownerUserId"
         ORDER BY
           "createdAt" ASC,
           "id" ASC
       ) AS row_number
  FROM "SenderProfile"
)
UPDATE "SenderProfile" AS sender_profile
SET "isDefault" = true
FROM ranked_sender_profiles
WHERE sender_profile."id" = ranked_sender_profiles."id"
  AND ranked_sender_profiles.row_number = 1;

CREATE INDEX "SenderProfile_ownerUserId_isDefault_idx"
ON "SenderProfile"("ownerUserId", "isDefault");

CREATE UNIQUE INDEX "SenderProfile_ownerUserId_default_key"
ON "SenderProfile"("ownerUserId")
WHERE "isDefault" = true;
