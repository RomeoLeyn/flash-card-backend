import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './entities/card.entity';
import { CategoryService } from '../category/category.service';
import { FlashcardData } from 'src/common/interfaces/flash-card-data.interface';

@Injectable()
export class CardService {
  constructor(
    @InjectRepository(Card) private readonly cardRepository: Repository<Card>,
    private readonly categoryService: CategoryService,
  ) { }

  async create(createCardDto: CreateCardDto, userId: string): Promise<Card> {
    const category = await this.categoryService.findByCategoryIdAndUserId(
      createCardDto.categoryId,
      userId,
    );

    const card = this.cardRepository.create({
      word: createCardDto.word,
      sourceLanguage: createCardDto.sourceLanguage,
      targetLanguage: createCardDto.targetLanguage,
      translation: createCardDto.translation,
      explanation: createCardDto.explanation,
      category,
      user: { id: userId },
      createdByAi: false,
    });

    return this.cardRepository.save(card);
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
        explanation: c.explanation,
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
  ): Promise<Card[]> {
    return this.cardRepository.find({
      where: { category: { id: categoryId }, user: { id: userId } },
    });
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
