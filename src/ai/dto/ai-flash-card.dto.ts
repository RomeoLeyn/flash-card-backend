// src/common/dto/ai-flashcard.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { IsOptional } from 'class-validator';

export class AiFlashCardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  word!: string;

  @IsString()
  @IsNotEmpty()
  sourceLanguage!: string;

  @IsString()
  @IsNotEmpty()
  targetLanguage!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  translation!: string;

  @IsString()
  @IsOptional()
  transcription?: string;

  @IsString()
  explanation!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  example!: string;
}
