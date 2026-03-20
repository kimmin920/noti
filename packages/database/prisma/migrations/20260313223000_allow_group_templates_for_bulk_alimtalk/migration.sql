ALTER TABLE "BulkAlimtalkCampaign"
ADD COLUMN "templateSource" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "templateName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "templateCode" TEXT;

ALTER TABLE "BulkAlimtalkCampaign"
ALTER COLUMN "providerTemplateId" DROP NOT NULL;

UPDATE "BulkAlimtalkCampaign" AS campaign
SET
  "templateName" = COALESCE(template_row."name", campaign."templateName"),
  "templateCode" = COALESCE(provider."templateCode", provider."kakaoTemplateCode", provider."nhnTemplateId", campaign."templateCode")
FROM "ProviderTemplate" AS provider
JOIN "Template" AS template_row ON template_row."id" = provider."templateId"
WHERE campaign."providerTemplateId" = provider."id";
