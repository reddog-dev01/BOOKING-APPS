import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateVehicleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  perKmVnd!: number;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }
    return value;
  })
  @IsBoolean()
  isActive!: boolean;
}
