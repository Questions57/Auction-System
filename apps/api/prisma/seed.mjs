import { PrismaClient, Role } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();
const hash = (auctionId, bidderId, amountCents, nonce) =>
  createHash('sha256').update(`${auctionId}:${bidderId}:${amountCents}:${nonce}`).digest('hex');

async function main() {
  const now = Date.now();
  await prisma.bid.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { id: 'demo-admin', email: 'admin@northstar.demo', name: 'Demo Administrator', role: Role.ADMIN },
      { id: 'demo-bidder', email: 'adarsh.patel@northstar.demo', name: 'Adarsh Patel', role: Role.BIDDER },
      { id: 'rival-bidder', email: 'marcus.wells@northstar.demo', name: 'Marcus Wells', role: Role.BIDDER },
    ],
  });

  const committing = await prisma.auction.create({
    data: {
      title: 'Nocturne in Blue',
      description: 'A signed limited-edition lithograph from the Northstar collection.',
      startsAt: new Date(now - 60 * 60 * 1000),
      revealAt: new Date(now + 60 * 60 * 1000),
      endsAt: new Date(now + 2 * 60 * 60 * 1000),
    },
  });
  const reveal = await prisma.auction.create({
    data: {
      title: 'The Cartographer’s Desk',
      description: 'A nineteenth-century walnut writing desk with original brass hardware.',
      startsAt: new Date(now - 2 * 60 * 60 * 1000),
      revealAt: new Date(now - 30 * 60 * 1000),
      endsAt: new Date(now + 30 * 60 * 1000),
    },
  });
  const closed = await prisma.auction.create({
    data: {
      title: 'Study of a Coastline',
      description: 'An original oil study on linen.',
      startsAt: new Date(now - 4 * 60 * 60 * 1000),
      revealAt: new Date(now - 3 * 60 * 60 * 1000),
      endsAt: new Date(now - 60 * 60 * 1000),
    },
  });

  const nonce = 'demo-reveal-nonce';
  await prisma.bid.createMany({
    data: [
      { auctionId: committing.id, bidderId: 'demo-bidder', commitmentHash: hash(committing.id, 'demo-bidder', 250000, nonce), committedAt: new Date(now - 30 * 60 * 1000) },
      { auctionId: reveal.id, bidderId: 'demo-bidder', commitmentHash: hash(reveal.id, 'demo-bidder', 250000, nonce), committedAt: new Date(now - 90 * 60 * 1000) },
      { auctionId: closed.id, bidderId: 'demo-bidder', commitmentHash: hash(closed.id, 'demo-bidder', 250000, nonce), amountCents: 250000, nonce, committedAt: new Date(now - 3.5 * 60 * 60 * 1000), revealedAt: new Date(now - 2 * 60 * 60 * 1000) },
      { auctionId: closed.id, bidderId: 'rival-bidder', commitmentHash: hash(closed.id, 'rival-bidder', 240000, nonce), amountCents: 240000, nonce, committedAt: new Date(now - 3.25 * 60 * 60 * 1000), revealedAt: new Date(now - 2 * 60 * 60 * 1000) },
    ],
  });

  await prisma.auctionEvent.createMany({
    data: [
      { auctionId: committing.id, actorId: 'demo-bidder', type: 'BID_COMMITTED', createdAt: new Date(now - 30 * 60 * 1000) },
      { auctionId: reveal.id, actorId: 'demo-bidder', type: 'BID_COMMITTED', createdAt: new Date(now - 90 * 60 * 1000) },
      { auctionId: closed.id, actorId: 'demo-bidder', type: 'BID_COMMITTED', createdAt: new Date(now - 3.5 * 60 * 60 * 1000) },
      { auctionId: closed.id, actorId: 'rival-bidder', type: 'BID_COMMITTED', createdAt: new Date(now - 3.25 * 60 * 60 * 1000) },
      { auctionId: closed.id, actorId: 'demo-bidder', type: 'BID_REVEALED', createdAt: new Date(now - 2 * 60 * 60 * 1000) },
      { auctionId: closed.id, actorId: 'rival-bidder', type: 'BID_REVEALED', createdAt: new Date(now - 2 * 60 * 60 * 1000) },
    ],
  });
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
