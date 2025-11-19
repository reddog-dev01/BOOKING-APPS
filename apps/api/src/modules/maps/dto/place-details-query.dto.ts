import { IsOptional, IsString } from 'class-validator';

export class PlaceDetailsQueryDto {
  @IsString()
  placeId!: string;

  @IsOptional()
  @IsString()
  sessionToken?: string;
}