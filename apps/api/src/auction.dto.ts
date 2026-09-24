import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Type(() => Date)
  @IsDate()
  revealAt!: Date;

  @Type(() => Date)
  @IsDate()
  endsAt!: Date;
}

export class CommitBidDto {
  @IsString()
  @IsNotEmpty()
  commitmentHash!: string;
}

export class RevealBidDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @IsNotEmpty()
  nonce!: string;
}

