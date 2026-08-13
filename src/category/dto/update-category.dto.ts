import { IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name!: string;

  @IsString()
  @IsOptional()
  sourceLanguage!: string;

  @IsString()
  @IsOptional()
  targetLanguage!: string;
}
