import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ExplainedFlashCardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  word!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}$/)
  sourceLanguage!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}$/)
  targetLanguage!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  translation!: string;

  @IsString()
  @MaxLength(100)
  transcription!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  explanation!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  example!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  detailedExplanation!: string;
}
