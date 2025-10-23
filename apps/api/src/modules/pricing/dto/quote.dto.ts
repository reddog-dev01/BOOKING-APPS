import { Type } from 'class-transformer';
import { IsArray, ArrayMaxSize, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, Max, ValidateIf } from 'class-validator';

export enum TripTypeDto { AIRPORT = 'AIRPORT', ROAD = 'ROAD' }
export enum DirectionDto { TO_AIRPORT = 'to_airport', FROM_AIRPORT = 'from_airport' }

export class QuoteRequestDto {
  @IsEnum(TripTypeDto) tripType!: TripTypeDto;
  @ValidateIf(o => o.tripType === TripTypeDto.ROAD) @IsOptional() @IsString() routeCode?: string;
  @ValidateIf(o => o.tripType === TripTypeDto.AIRPORT) @IsOptional() @IsString() airportCode?: string;
  @ValidateIf(o => o.tripType === TripTypeDto.AIRPORT) @IsOptional() @IsEnum(DirectionDto) direction?: DirectionDto;

  @IsInt() @Type(() => Number) vehicleTypeId!: number;

  @IsString() fromText!: string; @IsString() toText!: string;
  @IsOptional() @Type(() => Number) @IsNumber() fromLat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() fromLng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() toLat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() toLng?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) distanceKm?: number;
  @IsOptional() @IsBoolean() roundTrip?: boolean;
  @IsOptional() @IsBoolean() withVat?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) waitHours?: number;
  @IsOptional() @IsString() startAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) vatPct?: number; // 0|8|10
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) stops?: string[];
}
