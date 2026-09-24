import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HeaderAuthGuard, requireAdmin } from './auth.js';
import type { AuthenticatedRequest } from './auth.js';
import { CommitBidDto, CreateAuctionDto, RevealBidDto } from './auction.dto.js';
import { AuctionsService } from './auctions.service.js';
import { ApiTags } from '@nestjs/swagger';

@Controller('auctions')
@UseGuards(HeaderAuthGuard)
@ApiTags('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.auctions.findAll(req.user);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.auctions.findOne(id, req.user);
  }

  @Post()
  create(@Body() dto: CreateAuctionDto, @Req() req: AuthenticatedRequest) {
    requireAdmin(req.user);
    return this.auctions.create(dto, req.user);
  }

  @Post(':id/commitments')
  commit(@Param('id') id: string, @Body() dto: CommitBidDto, @Req() req: AuthenticatedRequest) {
    return this.auctions.commit(id, req.user, dto);
  }

  @Post(':id/reveal')
  reveal(@Param('id') id: string, @Body() dto: RevealBidDto, @Req() req: AuthenticatedRequest) {
    return this.auctions.reveal(id, req.user, dto);
  }

  @Post(':id/finalize')
  finalize(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    requireAdmin(req.user);
    return this.auctions.finalize(id, req.user);
  }
}
