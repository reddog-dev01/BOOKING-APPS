import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, Min } from 'class-validator';

type MapProvider = 'google' | 'manual';

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

  @IsIn(['google', 'manual'])
  mapProvider!: MapProvider;
}
