import { FlashcardData } from 'src/common/interfaces/flash-card-data.interface';

export class GeneratedCardsResponseDto {
  success!: boolean;
  category!: string;
  count!: number;
  cards!: FlashcardData[];
}
