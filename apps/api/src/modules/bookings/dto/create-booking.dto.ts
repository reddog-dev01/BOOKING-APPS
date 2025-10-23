import { Type } from 'class-transformer';
import {
  IsArray, ArrayMaxSize, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, Min, Max, ValidateIf
} from 'class-validator';

export enum TripTypeDto { AIRPORT='AIRPORT', ROAD='ROAD' }
export type DirectionDto = 'to_airport' | 'from_airport';

export class CreateBookingDto {
  @IsEnum(TripTypeDto) tripType!: TripTypeDto;

  // ROAD
  @ValidateIf(o=>o.tripType===TripTypeDto.ROAD) @IsOptional() @IsString() routeCode?: string;

  // AIRPORT
  @ValidateIf(o=>o.tripType===TripTypeDto.AIRPORT) @IsString() airportCode?: string;
  @ValidateIf(o=>o.tripType===TripTypeDto.AIRPORT) @IsEnum(DirectionDto) direction?: DirectionDto;

  @IsInt() @Type(()=>Number) vehicleTypeId!: number;

  // FE ưu tiên fromText/toText; nhưng chấp nhận alias fromLabel/toLabel
  @IsOptional() @IsString() fromText?: string;
  @IsOptional() @IsString() toText?: string;
  @IsOptional() @IsString() fromLabel?: string;
  @IsOptional() @IsString() toLabel?: string;

  @IsOptional() @Type(()=>Number) @IsNumber() fromLat?: number;
  @IsOptional() @Type(()=>Number) @IsNumber() fromLng?: number;
  @IsOptional() @Type(()=>Number) @IsNumber() toLat?: number;
  @IsOptional() @Type(()=>Number) @IsNumber() toLng?: number;

  @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) distanceKm?: number;

  @IsOptional() @IsBoolean() roundTrip?: boolean;

  // FE gửi withVat; map sang vatPct ở service
  @IsOptional() @IsBoolean() withVat?: boolean;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(0) @Max(10) vatPct?: number;

  // FE gửi waitHours khi roundTrip; map sang minutes ở service
  @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) waitHours?: number;

  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) stops?: string[];

  // Thời gian đi
  @IsOptional() @IsString() startAt?: string;

  // Contact
  @IsString() customerName!: string;
  @IsString() phone!: string;
}
