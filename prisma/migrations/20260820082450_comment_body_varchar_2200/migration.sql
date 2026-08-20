/*
  Warnings:

  - You are about to alter the column `body` on the `comments` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2200)`.

*/
-- AlterTable
ALTER TABLE "comments" ALTER COLUMN "body" SET DATA TYPE VARCHAR(2200);
