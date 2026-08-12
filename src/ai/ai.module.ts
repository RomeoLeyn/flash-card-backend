import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from 'src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CardModule } from 'src/card/card.module';
import { CategoryModule } from 'src/category/category.module';

@Module({
  imports: [AuthModule, ConfigModule, CardModule, CategoryModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule { }
