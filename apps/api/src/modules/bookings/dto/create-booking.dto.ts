import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { IsUuidOrCuid } from '../../../common/validation/is-uuid-or-cuid.decorator';

export class CreateBookingDto {
  @IsUuidOrCuid({ message: 'quoteId must be a UUID v4 or Prisma CUID' })
  quoteId!: string;

  @IsString()
  @MaxLength(160)
  customerName!: string;

  @IsString()
  @MaxLength(32)
  customerPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string;

  @IsOptional()
  @IsString()
  fromText?: string;

  @IsOptional()
  @IsString()
  toText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fromLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fromLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  toLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  toLng?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  stops?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm?: number;
}
