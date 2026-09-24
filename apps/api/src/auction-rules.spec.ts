import { describe, expect, it } from 'vitest';
import { getAuctionStatus, hasValidTimeline, selectWinner } from './auction-rules.js';

const startsAt = new Date('2026-01-01T10:00:00Z');
const revealAt = new Date('2026-01-01T11:00:00Z');
const endsAt = new Date('2026-01-01T12:00:00Z');
const auction = { startsAt, revealAt, endsAt };

describe('auction rules', () => {
  it('derives each phase from the server clock', () => {
    expect(getAuctionStatus(auction, new Date('2026-01-01T09:59:59Z'))).toBe('SCHEDULED');
    expect(getAuctionStatus(auction, new Date('2026-01-01T10:00:00Z'))).toBe('COMMITTING');
    expect(getAuctionStatus(auction, new Date('2026-01-01T11:00:00Z'))).toBe('REVEALING');
    expect(getAuctionStatus(auction, new Date('2026-01-01T12:00:00Z'))).toBe('CLOSED');
  });

  it('requires a strictly ordered auction timeline', () => {
    expect(hasValidTimeline(auction)).toBe(true);
    expect(hasValidTimeline({ startsAt, revealAt: startsAt, endsAt })).toBe(false);
    expect(hasValidTimeline({ startsAt: revealAt, revealAt: startsAt, endsAt })).toBe(false);
  });

  it('selects the highest valid reveal and breaks a tie by earliest commitment', () => {
    const winner = selectWinner([
      { amountCents: 2500, committedAt: new Date('2026-01-01T10:01:00Z') },
      { amountCents: null, committedAt: new Date('2026-01-01T10:00:00Z') },
      { amountCents: 3000, committedAt: new Date('2026-01-01T10:03:00Z') },
      { amountCents: 3000, committedAt: new Date('2026-01-01T10:02:00Z') },
    ]);

    expect(winner).toMatchObject({ amountCents: 3000, committedAt: new Date('2026-01-01T10:02:00Z') });
  });
});

