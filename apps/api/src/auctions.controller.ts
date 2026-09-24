import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HeaderAuthGuard, requireAdmin } from './auth.js';
import type { AuthenticatedRequest } from './auth.js';
import { CommitBidDto, CreateAuctionDto, RevealBidDto } from './auction.dto.js';
import { AuctionsService } from './auctions.service.js';

@Controller('auctions')
@UseGuards(HeaderAuthGuard)
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  list() {
    return this.auctions.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.auctions.findOne(id, req.user);
  }

  @Post()
  create(@Body() dto: CreateAuctionDto, @Req() req: AuthenticatedRequest) {
    requireAdmin(req.user);
    return this.auctions.create(dto);
  }

  @Post(':id/commitments')
  commit(@Param('id') id: string, @Body() dto: CommitBidDto, @Req() req: AuthenticatedRequest) {
    return this.auctions.commit(id, req.user, dto);
  }

  @Post(':id/reveal')
  reveal(@Param('id') id: string, @Body() dto: RevealBidDto, @Req() req: AuthenticatedRequest) {
    return this.auctions.reveal(id, req.user, dto);
  }
}
