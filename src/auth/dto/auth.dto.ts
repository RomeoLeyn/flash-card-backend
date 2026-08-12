import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(100)
  password!: string;

  //   @IsString()
  //   @IsOptional()
  //   @MaxLength(100)
  //   fullName?: string;
}

export class SignInDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fullName?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class AuthResponseDto {
  accessToken!: string;
  user!: {
    id: string;
    email: string;
  };
}
