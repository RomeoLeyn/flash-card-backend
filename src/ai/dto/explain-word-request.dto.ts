import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ExplainWordRequestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(100)
  word!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(500)
  sentence!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}$/)
  sourceLanguage!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}$/)
  targetLanguage!: string;
}
