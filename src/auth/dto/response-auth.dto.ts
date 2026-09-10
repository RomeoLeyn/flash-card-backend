import { ResponseUserDto } from 'src/user/dto/response-user.dto';

export class ResponseAuthDto {
  accessToken!: string;
  user!: ResponseUserDto;
}
