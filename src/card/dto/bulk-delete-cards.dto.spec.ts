import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkDeleteCardsDto } from './bulk-delete-cards.dto';

describe('BulkDeleteCardsDto', () => {
  const validIds = [
    '0c6c5e5b-3d98-4bf2-9696-42b85a7ac07b',
    'c0f5e0d7-ae2b-46c9-a0ba-62726cb96e35',
  ];

  async function validateIds(ids: unknown) {
    return validate(plainToInstance(BulkDeleteCardsDto, { ids }));
  }

  it('accepts a non-empty array of unique UUIDs', async () => {
    await expect(validateIds(validIds)).resolves.toHaveLength(0);
  });

  it.each([
    ['an empty array', []],
    ['duplicate IDs', [validIds[0], validIds[0]]],
    ['an invalid UUID', ['not-a-uuid']],
    ['a non-array value', validIds[0]],
  ])('rejects %s', async (_description, ids) => {
    await expect(validateIds(ids)).resolves.not.toHaveLength(0);
  });
});
