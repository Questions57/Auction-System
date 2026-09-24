-- DropIndex
DROP INDEX "Bid_auctionId_bidderId_key";

-- AlterTable
ALTER TABLE "Bid" ADD COLUMN "replacedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Bid_auctionId_bidderId_replacedAt_idx" ON "Bid"("auctionId", "bidderId", "replacedAt");
