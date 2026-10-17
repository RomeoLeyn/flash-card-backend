import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CardModule } from 'src/card/card.module';
import { CategoryModule } from 'src/category/category.module';
import { AiExplainRateLimitGuard } from './ai-explain-rate-limit.guard';

@Module({
  imports: [AuthModule, CardModule, CategoryModule],
  controllers: [AiController],
  providers: [AiService, AiExplainRateLimitGuard],
})
export class AiModule {}
