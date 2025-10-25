import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID('4')
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
