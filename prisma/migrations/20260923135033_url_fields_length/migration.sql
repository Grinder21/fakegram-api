ALTER TABLE "users" ALTER COLUMN "avatar_url" TYPE VARCHAR(2048) USING LEFT("avatar_url", 2048);
ALTER TABLE "photos" ALTER COLUMN "url" TYPE VARCHAR(2048) USING LEFT("url", 2048),
                     ALTER COLUMN "thumbnail_url" TYPE VARCHAR(2048) USING LEFT("thumbnail_url", 2048);
