import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkPermanentDeleteDto } from './bulk-permanent-delete.dto';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

async function validateBody(body: unknown) {
  return validate(plainToInstance(BulkPermanentDeleteDto, body));
}

describe('BulkPermanentDeleteDto', () => {
  it('rejects an empty memberIds array', async () => {
    const errors = await validateBody({ memberIds: [] });
    expect(errors.some((error) => error.property === 'memberIds')).toBe(true);
  });

  it('rejects non-UUID member ids', async () => {
    const errors = await validateBody({ memberIds: ['not-a-uuid', 'CEB-ME9902'] });
    const memberIdsError = errors.find((error) => error.property === 'memberIds');
    expect(memberIdsError).toBeDefined();
    expect(JSON.stringify(memberIdsError?.constraints ?? memberIdsError?.children)).toMatch(/uuid/i);
  });

  it('accepts UUID v4 member ids', async () => {
    const errors = await validateBody({ memberIds: [UUID_A, UUID_B] });
    expect(errors).toHaveLength(0);
  });
});
