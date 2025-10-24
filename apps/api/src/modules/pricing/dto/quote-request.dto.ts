import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum TripTypeDto {
  AIRPORT = 'AIRPORT',
  ROAD = 'ROAD',
}

export enum AirportDirectionDto {
  IN = 'IN',
  OUT = 'OUT',
}

export class QuoteRequestDto {
  @IsEnum(TripTypeDto)
  tripType!: TripTypeDto;

  @ValidateIf((payload) => payload.tripType === TripTypeDto.ROAD)
  @IsString()
  routeCode?: string;

  @ValidateIf((payload) => payload.tripType === TripTypeDto.AIRPORT)
  @IsString()
  airportCode?: string;

  @ValidateIf((payload) => payload.tripType === TripTypeDto.AIRPORT)
  @IsEnum(AirportDirectionDto)
  direction?: AirportDirectionDto;

  @IsInt()
  @Type(() => Number)
  vehicleTypeId!: number;

  @IsISO8601()
  startAt!: string;

  @IsBoolean()
  @Type(() => Boolean)
  roundTrip!: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  withVat!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  vatPct?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  stops?: string[];

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waitHours?: number;
}
