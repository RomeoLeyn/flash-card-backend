import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Repository } from 'typeorm';
import { getDatabaseErrorCode } from 'src/common/utils/database-error';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto, userId: string) {
    const category = this.categoryRepository.create({
      name: createCategoryDto.name,
      sourceLanguage: createCategoryDto.sourceLanguage,
      targetLanguage: createCategoryDto.targetLanguage,
      user: { id: userId },
    });

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      const databaseErrorCode = getDatabaseErrorCode(error);
      if (databaseErrorCode === '23505') {
        throw new ConflictException('Category with this name already exists');
      }
      if (databaseErrorCode === '23503') {
        throw new NotFoundException('User does not exist');
      }

      throw error;
    }
  }

  async findAll(userId: string) {
    return await this.categoryRepository.find({
      where: { user: { id: userId } },
    });
  }

  async findOne(userId: string, categoryId: string) {
    const category = await this.categoryRepository.findOne({
      where: { user: { id: userId }, id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findByCategoryIdAndUserId(categoryId: string, userId: string) {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, user: { id: userId } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    userId: string,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.findByCategoryIdAndUserId(id, userId);
    Object.assign(category, updateCategoryDto);

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (getDatabaseErrorCode(error) === '23505') {
        throw new ConflictException('Category with this name already exists');
      }

      throw error;
    }
  }

  async remove(id: string, userId: string) {
    const result = await this.categoryRepository
      .createQueryBuilder()
      .delete()
      .from(Category)
      .where('id = :id', { id })
      .andWhere('"userId" = :userId', { userId })
      .execute();

    if (!result.affected) {
      throw new NotFoundException('Category not found');
    }

    return result;
  }
}
