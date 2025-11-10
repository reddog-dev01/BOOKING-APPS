import { BookingStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const parseLimit = (value: unknown, defaultValue: number, max: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return defaultValue;
  }
  return Math.min(Math.max(Math.trunc(numeric), 1), max);
};

const BOOKING_STATUS_VALUES: BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CANCELED',
  'EXPIRED',
];

export class ListBookingsQueryDto {
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

  @IsOptional()
  @Transform(({ value }) => parseLimit(value, 50, 200))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ExportBookingsQueryDto extends ListBookingsQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseLimit(value, 500, 1000))
  @IsInt()
  @Min(1)
  @Max(1000)
  override limit?: number;
}
