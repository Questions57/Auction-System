import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_BID_CENTS } from './auction-rules.js';

export class CreateAuctionDto {
  @ApiProperty({ example: 'Nocturne in Blue' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'A signed limited-edition lithograph.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-09-25T18:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @ApiProperty({ example: '2026-09-25T19:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  revealAt!: Date;

  @ApiProperty({ example: '2026-09-25T20:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;
}

export class CommitBidDto {
  @ApiProperty({ description: 'SHA-256(auctionId:bidderId:amountCents:nonce)', example: 'ac4f...' })
  @IsString()
  @Matches(/^[a-f\d]{64}$/i, { message: 'commitmentHash must be a valid SHA-256 hash.' })
  commitmentHash!: string;
}

export class RevealBidDto {
  @ApiProperty({ example: 250000, description: 'Whole US cents' })
  @IsInt()
  @Min(1)
  @Max(MAX_BID_CENTS)
  amountCents!: number;

  @ApiProperty({ example: 'a private random UUID generated at commitment time' })
  @IsString()
  @IsNotEmpty()
  nonce!: string;
}
