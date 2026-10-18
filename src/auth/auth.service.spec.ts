import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DeepPartial, Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('creates a user without a preflight duplicate query', async () => {
    const user = { id: 'user-id', email: 'user@example.com' } as User;
    const userRepository = {
      create: jest.fn((value: DeepPartial<User>) => value),
      save: jest.fn().mockResolvedValue(user),
      findOne: jest.fn(),
    };
    const jwtService = { sign: jest.fn().mockReturnValue('token') };
    const service = new AuthService(
      jwtService as unknown as JwtService,
      userRepository as unknown as Repository<User>,
    );

    const result = await service.signUp({
      email: user.email,
      password: 'password123',
    });

    expect(result.accessToken).toBe('token');
    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalledTimes(1);
  });

  it('maps duplicate-email database errors to a conflict response', async () => {
    const userRepository = {
      create: jest.fn((value: DeepPartial<User>) => value),
      save: jest.fn().mockRejectedValue({
        driverError: { code: '23505' },
      }),
    };
    const service = new AuthService(
      { sign: jest.fn() } as unknown as JwtService,
      userRepository as unknown as Repository<User>,
    );

    await expect(
      service.signUp({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
