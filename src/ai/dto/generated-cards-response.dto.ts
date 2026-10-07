import { FlashcardData } from 'src/common/interfaces/flash-card-data.interface';
import { AiGenerationLevel } from '../ai-generation-level.enum';

export class GeneratedCardsResponseDto {
  success!: boolean;
  category!: string;
  count!: number;
  level!: AiGenerationLevel | null;
  cards!: FlashcardData[];
}
