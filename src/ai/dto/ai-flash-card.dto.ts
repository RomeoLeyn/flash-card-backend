import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { IsOptional } from 'class-validator';

export class AiFlashCardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  word!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}$/, {
    message: 'sourceLanguage must be ISO 639-1 code',
  })
  sourceLanguage!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}$/, {
    message: 'targetLanguage must be ISO 639-1 code',
  })
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
