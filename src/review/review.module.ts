import { forwardRef, Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { ReviewLog } from './entities/review.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardModule } from 'src/card/card.module';
import { Card } from 'src/card/entities/card.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewLog, Card]),
    forwardRef(() => CardModule),
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
