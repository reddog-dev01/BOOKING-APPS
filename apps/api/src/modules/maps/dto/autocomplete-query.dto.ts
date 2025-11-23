import { IsOptional, IsString, MinLength } from 'class-validator';

export class AutocompleteQueryDto {
  @IsString()
  @MinLength(2)
  input!: string;

  @IsOptional()
  @IsString()
  sessionToken?: string;
}