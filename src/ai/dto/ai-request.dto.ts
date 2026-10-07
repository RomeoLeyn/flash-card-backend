import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AiGenerationMode } from '../ai-generation-mode.enum';
import { AiGenerationLevel } from '../ai-generation-level.enum';

export class AiRequestDto {
  @IsEnum(AiGenerationMode)
  mode!: AiGenerationMode;

  @IsNotEmpty()
  @IsUUID()
  categoryId!: string;

  @ValidateIf(
    (request: AiRequestDto) => request.mode === AiGenerationMode.GENERATE,
  )
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsEnum(AiGenerationLevel)
  level?: AiGenerationLevel;

  @ValidateIf(
    (request: AiRequestDto) =>
      request.mode === AiGenerationMode.GENERATE ||
      request.prompt !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  prompt?: string;

  @ValidateIf(
    (request: AiRequestDto) => request.mode === AiGenerationMode.FROM_LIST,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(100, { each: true })
  words?: string[];
}
