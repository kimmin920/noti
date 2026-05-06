CREATE TYPE "AlimtalkTemplateBindingMode" AS ENUM ('DEFAULT', 'CUSTOM');

ALTER TABLE "EventRule"
ADD COLUMN "alimtalkTemplateBindingMode" "AlimtalkTemplateBindingMode" NOT NULL DEFAULT 'CUSTOM';
