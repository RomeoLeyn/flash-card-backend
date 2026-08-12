import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CardService } from './card.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { ReviewService } from 'src/review/review.service';
import { GetDueCardsDto } from './dto/get-due-cards.dto';
import { ReviewCardDto } from './dto/review-card.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';

@Controller('cards')
export class CardController {
  constructor(
    private readonly cardService: CardService,
    private readonly reviewService: ReviewService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser('id') userId: string,
    @Body() createCardDto: CreateCardDto,
  ) {
    return this.cardService.create(createCardDto, userId);
  }

  @Get('/category/:categoryId')
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser('id') userId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.cardService.findAllByCategoryId(categoryId, userId);
  }

  @Get('/card/:id')
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.cardService.findOne(id, userId);
  }

  @Patch('/update/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.cardService.update(id, updateCardDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.cardService.remove(id, userId);
  }

  @Get('due')
  @UseGuards(JwtAuthGuard)
  async getDueCards(@Query() query: GetDueCardsDto, @CurrentUser() user: User) {
    return this.reviewService.getDueCards(user.id, {
      categoryId: query.categoryId,
    });
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard)
  async reviewCard(
    @Param('id') id: string,
    @Body() dto: ReviewCardDto,
    @CurrentUser('id') userId: string,
  ) {
    const card = await this.cardService.findOne(id, userId);
    if (!card) throw new NotFoundException('Card not found');

    return this.reviewService.reviewCard(card, dto.quality);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser('id') userId: string) {
    return this.reviewService.getStats(userId);
  }
}
