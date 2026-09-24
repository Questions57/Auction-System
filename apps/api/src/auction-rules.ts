import { Auction, Bid } from '@prisma/client';

export type AuctionStatus = 'SCHEDULED' | 'COMMITTING' | 'REVEALING' | 'CLOSED';
export const MAX_BID_CENTS = 1_000_000_000;

export function getAuctionStatus(auction: Pick<Auction, 'startsAt' | 'revealAt' | 'endsAt'>, now = new Date()): AuctionStatus {
  if (now < auction.startsAt) return 'SCHEDULED';
  if (now < auction.revealAt) return 'COMMITTING';
  if (now < auction.endsAt) return 'REVEALING';
  return 'CLOSED';
}

export function hasValidTimeline({ startsAt, revealAt, endsAt }: Pick<Auction, 'startsAt' | 'revealAt' | 'endsAt'>) {
  return startsAt < revealAt && revealAt < endsAt;
}

export function isCommitmentHash(value: string) {
  return /^[a-f\d]{64}$/i.test(value);
}

export function selectWinner<T extends Pick<Bid, 'amountCents' | 'committedAt'>>(bids: T[]) {
  return bids
    .filter((bid): bid is T & { amountCents: number } => bid.amountCents !== null)
    .sort((a, b) => b.amountCents - a.amountCents || a.committedAt.getTime() - b.committedAt.getTime())[0];
}
