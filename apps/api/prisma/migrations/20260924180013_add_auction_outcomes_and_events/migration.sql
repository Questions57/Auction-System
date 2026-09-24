-- CreateTable
CREATE TABLE "AuctionOutcome" (
    "auctionId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "winnerBidId" TEXT,
    "winnerBidderName" TEXT,
    "winningAmountCents" INTEGER,
    "finalizedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionOutcome_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuctionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionEvent_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuctionEvent_auctionId_createdAt_idx" ON "AuctionEvent"("auctionId", "createdAt");
