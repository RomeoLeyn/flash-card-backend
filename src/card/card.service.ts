import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './entities/card.entity';
import { CategoryService } from '../category/category.service';
import { FlashcardData } from 'src/common/interfaces/flash-card-data.interface';
import { CardSortBy, SortOrder } from 'src/common/enums/sort-order.enum';

function getDatabaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('driverError' in error)
  ) {
    return undefined;
  }

  const driverError = error.driverError;
  if (
    typeof driverError !== 'object' ||
    driverError === null ||
    !('code' in driverError)
  ) {
    return undefined;
  }

  return typeof driverError.code === 'string' ? driverError.code : undefined;
}

@Injectable()
export class CardService {
  constructor(
    @InjectRepository(Card) private readonly cardRepository: Repository<Card>,
    private readonly categoryService: CategoryService,
  ) {}

  async create(createCardDto: CreateCardDto, userId: string): Promise<Card> {
    const category = await this.categoryService.findByCategoryIdAndUserId(
      createCardDto.categoryId,
      userId,
    );

    const duplicate = await this.cardRepository
      .createQueryBuilder('card')
      .where('card.userId = :userId', { userId })
      .andWhere('card.sourceLanguage = :sourceLanguage', {
        sourceLanguage: createCardDto.sourceLanguage,
      })
      .andWhere('card.targetLanguage = :targetLanguage', {
        targetLanguage: createCardDto.targetLanguage,
      })
      .andWhere('LOWER(TRIM(card.word)) = LOWER(TRIM(:word))', {
        word: createCardDto.word,
      })
      .getOne();

    if (duplicate) {
      throw new ConflictException('A card with this word already exists.');
    }

    const card = this.cardRepository.create({
      word: createCardDto.word,
      sourceLanguage: createCardDto.sourceLanguage,
      targetLanguage: createCardDto.targetLanguage,
      translation: createCardDto.translation,
      transcription: createCardDto.transcription,
      explanation: createCardDto.explanation,
      example: createCardDto.example,
      category,
      user: { id: userId },
      createdByAi: false,
    });

    try {
      return await this.cardRepository.save(card);
    } catch (error) {
      if (getDatabaseErrorCode(error) === '23505') {
        throw new ConflictException('A card with this word already exists.');
      }

      throw error;
    }
  }

  async bulkCreateFromAi(
    cardsData: FlashcardData[],
    userId: string,
    categoryId: string,
  ): Promise<{
    created: number;
    skipped: number;
    createdCards: Card[];
    skippedWords: string[];
  }> {
    if (!cardsData.length) {
      return { created: 0, skipped: 0, createdCards: [], skippedWords: [] };
    }

    const inputMap = new Map<string, FlashcardData>();
    for (const c of cardsData) {
      const key = `${c.word}||${c.sourceLanguage}||${c.targetLanguage}`;
      if (!inputMap.has(key)) inputMap.set(key, c);
    }

    const uniqueInputs = Array.from(inputMap.values());

    const existingConditions = uniqueInputs.map((c) => ({
      user: { id: userId },
      word: c.word,
      sourceLanguage: c.sourceLanguage,
      targetLanguage: c.targetLanguage,
    }));

    const existing = existingConditions.length
      ? await this.cardRepository.find({ where: existingConditions })
      : [];

    const existingKeys = new Set(
      existing.map(
        (e) => `${e.word}||${e.sourceLanguage}||${e.targetLanguage}`,
      ),
    );

    const toInsert = uniqueInputs.filter(
      (c) =>
        !existingKeys.has(
          `${c.word}||${c.sourceLanguage}||${c.targetLanguage}`,
        ),
    );
    const skipped = uniqueInputs.filter((c) =>
      existingKeys.has(`${c.word}||${c.sourceLanguage}||${c.targetLanguage}`),
    );

    const entities = toInsert.map((c) =>
      this.cardRepository.create({
        word: c.word,
        sourceLanguage: c.sourceLanguage,
        targetLanguage: c.targetLanguage,
        translation: c.translation,
        transcription: c.transcription,
        explanation: c.explanation,
        example: c.example,
        level: c.level ?? null,
        createdByAi: true,
        user: { id: userId },
        category: { id: categoryId },
      }),
    );

    const createdCards = entities.length
      ? await this.cardRepository.save(entities)
      : [];

    return {
      created: createdCards.length,
      skipped: skipped.length,
      createdCards,
      skippedWords: skipped.map((s) => s.word),
    };
  }

  async findAllByCategoryId(
    categoryId: string,
    userId: string,
    sortBy: CardSortBy = CardSortBy.WORD,
    sortOrder: SortOrder = SortOrder.ASC,
  ): Promise<Card[]> {
    const qb = this.cardRepository
      .createQueryBuilder('card')
      .where('card.categoryId = :categoryId', { categoryId })
      .andWhere('card.userId = :userId', { userId });

    if (
      sortBy === CardSortBy.LAST_REVIEWED_AT ||
      sortBy === CardSortBy.NEXT_REVIEW_DATE
    ) {
      qb.orderBy(`card.${sortBy}`, sortOrder, 'NULLS LAST');
    } else {
      qb.orderBy(`card.${sortBy}`, sortOrder);
    }

    return qb.getMany();
  }

  async findOne(id: string, userId: string): Promise<Card> {
    const card = await this.cardRepository.findOne({
      where: { id, user: { id: userId } },
      relations: { category: true },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    return card;
  }

  async remove(id: string, userId: string): Promise<void> {
    const card = await this.findOne(id, userId);
    await this.cardRepository.remove(card);
  }

  async bulkRemove(
    ids: string[],
    userId: string,
  ): Promise<{ deleted: number }> {
    const result = await this.cardRepository
      .createQueryBuilder()
      .delete()
      .from(Card)
      .where('id IN (:...ids)', { ids })
      .andWhere('"userId" = :userId', { userId })
      .execute();

    return { deleted: result.affected ?? 0 };
  }

  async update(
    id: string,
    updateCardDto: UpdateCardDto,
    userId: string,
  ): Promise<Card> {
    const card = await this.findOne(id, userId);

    if (updateCardDto.categoryId) {
      const category = await this.categoryService.findByCategoryIdAndUserId(
        updateCardDto.categoryId,
        userId,
      );
      card.category = category;
    }

    Object.assign(card, updateCardDto);

    return this.cardRepository.save(card);
  }
}
