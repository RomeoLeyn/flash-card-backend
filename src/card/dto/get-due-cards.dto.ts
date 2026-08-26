import { IsOptional, IsUUID, IsString } from 'class-validator';

export class GetDueCardsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // For future you must change this for number
  @IsOptional()
  @IsString()
  limit?: number = 20;
}
