-- AlterTable
ALTER TABLE "hosts" ADD COLUMN     "averageRating" DOUBLE PRECISION,
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0;
