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
import { UserService } from '../user/user.service';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly userService: UserService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto, userId: string) {
    const existing = await this.categoryRepository.findOne({
      where: { name: createCategoryDto.name, user: { id: userId } },
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const category = this.categoryRepository.create({
      name: createCategoryDto.name,
      sourceLanguage: createCategoryDto.sourceLanguage,
      targetLanguage: createCategoryDto.targetLanguage,
      user,
    });

    return this.categoryRepository.save(category);
  }

  async findAll(userId: string) {
    return await this.categoryRepository.find({
      where: { user: { id: userId } },
    });
  }

  async findOne(userId: string) {
    const category = await this.categoryRepository.findOne({
      where: { user: { id: userId } },
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

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.categoryRepository.update(id, updateCategoryDto);
    return this.categoryRepository.findOne({ where: { id } });
  }

  remove(id: number) {
    return `This action removes a #${id} category`;
  }
}
