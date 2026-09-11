import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AiRequestDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsNotEmpty()
  @IsUUID()
  categoryId!: string;
}
