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
  transcription?: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  example?: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;
}
