import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  word!: string;

  @IsString()
  @IsNotEmpty()
  sourceLanguage!: string;

  @IsString()
  @IsNotEmpty()
  targetLanguage!: string;

  @IsString()
  @IsNotEmpty()
  translation!: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;
}
