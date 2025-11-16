import { BookingStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const BOOKING_STATUS_VALUES: BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CANCELED',
  'EXPIRED',
];

const toBoundedLimit = (value: unknown, fallback: number, max: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(numeric), 1), max);
};

export class BaseListBookingsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(BOOKING_STATUS_VALUES)
  status?: BookingStatus;

  @IsOptional()
  @IsISO8601()
  startDateFrom?: string;

  @IsOptional()
  @IsISO8601()
  startDateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  cursor?: string;
}

export class ListBookingsQueryDto extends BaseListBookingsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoundedLimit(value, 50, 200))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ExportBookingsQueryDto extends BaseListBookingsQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoundedLimit(value, 500, 1000))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
