import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  it('updates only the password field after validating the current password', async () => {
    const passwordHash = bcrypt.hashSync('current-password', 8);
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'user-id',
        passwordHash,
      }),
    };
    const updatedPasswordHashes: unknown[] = [];
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn(
        (_criteria: object, partialEntity: { passwordHash: string }) => {
          updatedPasswordHashes.push(partialEntity.passwordHash);
          return { affected: 1 };
        },
      ),
      save: jest.fn(),
    };
    const service = new UserService(repository as unknown as Repository<User>);

    await service.changePassword('user-id', {
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'user-id', passwordHash },
      expect.anything(),
    );
    expect(typeof updatedPasswordHashes[0]).toBe('string');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
