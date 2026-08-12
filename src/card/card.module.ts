import { forwardRef, Module } from '@nestjs/common';
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from './entities/card.entity';
import { CategoryModule } from '../category/category.module';
import { UserModule } from '../user/user.module';
import { ReviewModule } from 'src/review/review.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Card]),
    CategoryModule,
    UserModule,
    AuthModule,
    forwardRef(() => ReviewModule),
  ],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}
