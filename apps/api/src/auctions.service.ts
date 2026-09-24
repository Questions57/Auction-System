import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Auction, Bid, Prisma, Role } from '@prisma/client';
import { CurrentUser } from './auth.js';
import { CommitBidDto, CreateAuctionDto, RevealBidDto } from './auction.dto.js';
import { PrismaService } from './prisma.service.js';
import { getAuctionStatus, hasValidTimeline, selectWinner } from './auction-rules.js';

type AuctionWithBids = Auction & { bids: (Bid & { bidder: { name: string } })[] };

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuctionDto) {
    if (!hasValidTimeline(dto)) {
      throw new BadRequestException('Auction times must satisfy start < reveal < end.');
    }
    return this.prisma.auction.create({ data: dto });
  }

  async findAll() {
    const auctions = await this.prisma.auction.findMany({
      orderBy: { startsAt: 'asc' },
      include: { bids: { include: { bidder: { select: { name: true } } } } },
    });
    return auctions.map((auction) => {
      const { bids, ...auctionSummary } = auction;
      const status = getAuctionStatus(auction);
      const winner = status === 'CLOSED' ? selectWinner(bids) : undefined;
      return {
        ...auctionSummary,
        status,
        winner: winner && { bidderName: winner.bidder.name, amountCents: winner.amountCents },
      };
    });
  }

  async findOne(id: string, viewer: CurrentUser) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: { bids: { include: { bidder: { select: { name: true } } }, orderBy: { committedAt: 'asc' } } },
    });
    if (!auction) throw new NotFoundException('Auction not found.');
    return this.present(auction, viewer);
  }

  async commit(auctionId: string, user: CurrentUser, dto: CommitBidDto) {
    const auction = await this.getAuction(auctionId);
    if (user.role !== Role.BIDDER) throw new BadRequestException('Only bidders may commit bids.');
    if (getAuctionStatus(auction) !== 'COMMITTING') {
      throw new BadRequestException('Bids can only be committed during the commitment phase.');
    }
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: `${user.id}@demo.auction`, name: 'Maya Chen', role: Role.BIDDER },
      update: {},
    });
    return this.prisma.bid.upsert({
      where: { auctionId_bidderId: { auctionId, bidderId: user.id } },
      create: { auctionId, bidderId: user.id, commitmentHash: dto.commitmentHash.toLowerCase() },
      update: { commitmentHash: dto.commitmentHash.toLowerCase(), amountCents: null, nonce: null, revealedAt: null },
    });
  }

  async reveal(auctionId: string, user: CurrentUser, dto: RevealBidDto) {
    const auction = await this.getAuction(auctionId);
    if (getAuctionStatus(auction) !== 'REVEALING') {
      throw new BadRequestException('Bids can only be revealed during the reveal phase.');
    }
    const bid = await this.prisma.bid.findUnique({ where: { auctionId_bidderId: { auctionId, bidderId: user.id } } });
    if (!bid) throw new NotFoundException('No commitment was submitted for this auction.');
    const expected = this.commitment(auctionId, user.id, dto.amountCents, dto.nonce);
    if (expected !== bid.commitmentHash) {
      throw new BadRequestException('Reveal does not match the submitted commitment.');
    }
    return this.prisma.bid.update({
      where: { id: bid.id },
      data: { amountCents: dto.amountCents, nonce: dto.nonce, revealedAt: new Date() },
    });
  }

  commitment(auctionId: string, bidderId: string, amountCents: number, nonce: string) {
    return createHash('sha256').update(`${auctionId}:${bidderId}:${amountCents}:${nonce}`).digest('hex');
  }

  private async getAuction(id: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id } });
    if (!auction) throw new NotFoundException('Auction not found.');
    return auction;
  }

  private present(auction: AuctionWithBids, viewer: CurrentUser) {
    const status = getAuctionStatus(auction);
    const canSeeReveals = status === 'CLOSED' || viewer.role === Role.ADMIN;
    const winner = status === 'CLOSED' ? selectWinner(auction.bids) : undefined;
    return {
      ...auction,
      status,
      winner: winner && { bidderName: winner.bidder.name, amountCents: winner.amountCents },
      bids: auction.bids.map((bid) => ({
        id: bid.id,
        committedAt: bid.committedAt,
        revealedAt: bid.revealedAt,
        amountCents: canSeeReveals ? bid.amountCents : undefined,
        bidderName: viewer.role === Role.ADMIN || bid.bidderId === viewer.id ? bid.bidder.name : undefined,
      })),
    };
  }
}
