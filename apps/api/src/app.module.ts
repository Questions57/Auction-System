import { Module } from '@nestjs/common';
import { AuctionsController } from './auctions.controller.js';
import { AuctionsService } from './auctions.service.js';
import { HeaderAuthGuard } from './auth.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [],
  controllers: [AuctionsController],
  providers: [AuctionsService, HeaderAuthGuard, PrismaService],
})
export class AppModule {}
