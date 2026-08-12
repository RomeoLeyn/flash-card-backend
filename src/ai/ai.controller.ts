import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AiRequestDto } from './dto/ai-request.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('/generate')
  @UseGuards(JwtAuthGuard)
  async generateCardsFromAi(
    @Body() aiRequest: AiRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.aiService.generateResponse(
      aiRequest.prompt,
      aiRequest.categoryId,
      userId,
    );
  }
}
