-- A bidder can retain historical replaced commitments, but exactly one can remain active.
CREATE UNIQUE INDEX "Bid_one_active_per_bidder_auction"
ON "Bid"("auctionId", "bidderId")
WHERE "replacedAt" IS NULL;
