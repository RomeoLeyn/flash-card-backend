import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { plainToInstance } from 'class-transformer';
import { ResponseUserDto } from './dto/response-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = this.userRepository.create({
      email: createUserDto.email,
      passwordHash: bcrypt.hashSync(createUserDto.password, 8),
    });

    const savedUser = await this.userRepository.save(user);
    return plainToInstance(ResponseUserDto, savedUser, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id: id },
    });

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    return user;
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.userRepository.save(user);
  }
}
