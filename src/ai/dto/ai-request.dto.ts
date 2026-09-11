import { IsNotEmpty, IsString } from 'class-validator';

export class AiRequestDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}
