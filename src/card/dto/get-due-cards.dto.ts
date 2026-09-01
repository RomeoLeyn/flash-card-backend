import { IsOptional, IsUUID, IsString, IsEnum } from 'class-validator';
import { CardSortBy, SortOrder } from 'src/common/enums/sort-order.enum';

export class GetDueCardsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  limit?: number = 20;

  @IsOptional()
  @IsEnum(CardSortBy)
  sortBy?: CardSortBy = CardSortBy.WORD;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;
}
