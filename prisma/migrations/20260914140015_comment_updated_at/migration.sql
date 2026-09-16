ALTER TABLE "comments" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "comments" SET "updated_at" = "created_at";
ALTER TABLE "comments" ALTER COLUMN "updated_at" DROP DEFAULT;