import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  vatOptions!: number[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultVatPct!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  waitRatePerHour!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  roundTripWaitMinutes!: number;
}
