import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: User,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.categoryService.create(createCategoryDto, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: User) {
    return this.categoryService.findAll(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, user.id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.categoryService.remove(+id);
  }
}
