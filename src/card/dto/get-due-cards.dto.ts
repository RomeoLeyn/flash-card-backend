import { Type } from 'class-transformer';
import { IsOptional, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { MIN_VALUE_LIMIT } from 'src/common/constants/constants';
import { CardSortBy, SortOrder } from 'src/common/enums/sort-order.enum';

export class GetDueCardsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_VALUE_LIMIT)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(CardSortBy)
  sortBy?: CardSortBy = CardSortBy.WORD;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;
}
