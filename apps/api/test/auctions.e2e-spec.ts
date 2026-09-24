import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma.service.js';

const bidderHeaders = { 'x-user-id': 'bidder-1', 'x-user-role': 'BIDDER' };
const adminHeaders = { 'x-user-id': 'admin-1', 'x-user-role': 'ADMIN' };

describe('auction API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.auctionEvent.deleteMany();
    await prisma.auctionOutcome.deleteMany();
    await prisma.bid.deleteMany();
    await prisma.auction.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces identity and administrator-only auction creation', async () => {
    await request(app.getHttpServer()).get('/auctions').expect(401);
    await request(app.getHttpServer())
      .post('/auctions')
      .set(bidderHeaders)
      .send({ title: 'Lot', startsAt: '2099-01-01T10:00:00Z', revealAt: '2099-01-01T11:00:00Z', endsAt: '2099-01-01T12:00:00Z' })
      .expect(403);
  });

  it('preserves replacement history while allowing one active commitment', async () => {
    const auction = await prisma.auction.create({
      data: { title: 'Live lot', startsAt: new Date(Date.now() - 1_000), revealAt: new Date(Date.now() + 60_000), endsAt: new Date(Date.now() + 120_000) },
    });
    const hash = (nonce: string) => createHash('sha256').update(`${auction.id}:bidder-1:10000:${nonce}`).digest('hex');

    await request(app.getHttpServer())
      .post(`/auctions/${auction.id}/commitments`)
      .set(bidderHeaders)
      .send({ commitmentHash: 'invalid' })
      .expect(400);
    await request(app.getHttpServer()).post(`/auctions/${auction.id}/commitments`).set(bidderHeaders).send({ commitmentHash: hash('one') }).expect(201);
    await request(app.getHttpServer()).post(`/auctions/${auction.id}/commitments`).set(bidderHeaders).send({ commitmentHash: hash('two') }).expect(201);

    const bids = await prisma.bid.findMany({ where: { auctionId: auction.id }, orderBy: { committedAt: 'asc' } });
    expect(bids).toHaveLength(2);
    expect(bids.filter((bid) => bid.replacedAt === null)).toHaveLength(1);
  });

  it('finalizes a closed auction once and records an audit event', async () => {
    const bidder = await prisma.user.create({ data: { id: 'bidder-1', email: 'bidder@example.com', name: 'Bidder', role: 'BIDDER' } });
    const now = Date.now();
    const auction = await prisma.auction.create({
      data: { title: 'Closed lot', startsAt: new Date(now - 3_600_000), revealAt: new Date(now - 2_400_000), endsAt: new Date(now - 1_200_000) },
    });
    await prisma.bid.create({
      data: {
        auctionId: auction.id,
        bidderId: bidder.id,
        commitmentHash: 'a'.repeat(64),
        amountCents: 125000,
        nonce: 'verified-nonce',
        revealedAt: new Date(now - 1_800_000),
      },
    });

    const first = await request(app.getHttpServer()).post(`/auctions/${auction.id}/finalize`).set(adminHeaders).expect(201);
    expect(first.body).toMatchObject({ status: 'SOLD', winningAmountCents: 125000 });
    const second = await request(app.getHttpServer()).post(`/auctions/${auction.id}/finalize`).set(adminHeaders).expect(201);
    expect(second.body.id).toBe(first.body.id);

    const events = await prisma.auctionEvent.findMany({ where: { auctionId: auction.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('AUCTION_FINALIZED');
  });
});

