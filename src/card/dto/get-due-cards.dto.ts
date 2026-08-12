import { Type } from 'class-transformer';
import { IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';

export class GetDueCardsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}
