# Northstar Auction House

A full-stack sealed-bid auction application built with **Next.js**, **NestJS**, and **Prisma**.

## Quick start

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. `cd apps/api && npx prisma migrate dev --name init && npm run seed`
3. Start the API: `npm run dev:api`
4. Start the web app in another terminal: `npm run dev:web`
5. Open `http://localhost:3000`.

## Assumptions and rules

- One lot belongs to each auction and all currency values are integer US cents.
- The API server clock is authoritative. An auction flows from `SCHEDULED` to `COMMITTING`, `REVEALING`, and `CLOSED`.
- A bid commitment is `SHA-256(auctionId:bidderId:amountCents:nonce)`. The nonce is generated in the browser and retained in local storage until reveal.
- Each bidder may maintain one commitment; a replacement is allowed only during the commitment phase.
- Only correctly revealed commitments are valid. The highest valid reveal wins; ties resolve to the earliest commitment.
- In this case-study build, header-based demo identity (`x-user-id`, `x-user-role`) makes the role boundary explicit without hiding it behind incomplete authentication. Replace this guard with a verified session/JWT provider before production.

## API

All endpoints require `x-user-id` and `x-user-role` (`ADMIN` or `BIDDER`).

- `GET /auctions`
- `GET /auctions/:id`
- `POST /auctions` (admin)
- `POST /auctions/:id/commitments`
- `POST /auctions/:id/reveal`

Interactive API documentation is available at `http://localhost:3001/api/docs`. Seeded data covers commitment, reveal, and closed auction states.

## Testing

Run `npm test` for focused auction-rule tests. They cover lifecycle time boundaries, timeline validation, valid-reveal selection, and deterministic tie-breaking.

## Edge cases and graceful handling

The API, not the UI, enforces the auction lifecycle. It rejects invalid timelines; commitments submitted before the start, after the reveal phase, or after close; reveals outside the reveal phase; missing commitments; and reveals whose amount or nonce does not reproduce the stored commitment. Invalid or non-positive amounts are rejected.

Only one active commitment is retained per bidder; replaced commitments remain in the audit history. A bidder may replace the active commitment during the commitment phase, but never after reveal begins. Unrevealed or invalid bids cannot win. If valid bids tie, the earliest commitment wins deterministically. The frontend communicates unavailable auction actions, empty catalogues, unavailable API connections, and the loss of local commitment data.

Additional safeguards include SHA-256-format validation for commitments, a maximum offer of $10,000,000.00, future-only auction scheduling, one active commitment per bidder enforced by a database index, and duplicate-reveal rejection. The browser refreshes auction state every 15 seconds; the server remains authoritative at every phase boundary.

## Deliberate production follow-ups

This case study prioritizes the auction-domain rules rather than presenting every operational concern as complete:

- **Identity:** Demo header-based identity makes role boundaries easy to review. Production must use verified authentication and server-issued role claims.
- **Reveal credentials:** The private nonce is stored in browser local storage. Clearing browser data or changing devices prevents a bidder from revealing; this is surfaced in the UI. A production product should offer an encrypted export/recovery flow or explicitly document a custody model.
- **Finalization and auditability:** The winner is currently derived deterministically at read time. Production should use an idempotent transaction to persist finalization and append an audit event for every commitment, reveal, and outcome.
- **Abuse protection:** Production needs rate limiting, idempotency keys, observability, verified identity, and appropriate bid limits.
- **Concurrency:** Server-side phase checks protect normal boundary behavior. Before launch, add database-backed integration tests for concurrent commitments/reveals at phase transitions and transactional finalization.

## Production considerations

Use PostgreSQL, verified authentication, HTTPS, rate limiting, durable job scheduling/notifications, encrypted audit logs, and a secret manager before public deployment. The cryptographic commitment prevents bid disclosure before reveal; it does not replace transport security or identity verification.
