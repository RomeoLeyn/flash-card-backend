import { IsEnum } from 'class-validator';
import { ReviewQuality } from 'src/common/enums/rewiev-quality.enum';

export class ReviewCardDto {
  @IsEnum(ReviewQuality)
  quality!: ReviewQuality;
}
