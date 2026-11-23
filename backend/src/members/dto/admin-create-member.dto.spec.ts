import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AdminCreateMemberDto } from './admin-create-member.dto';

// Same options as the global pipe in main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

async function run(body: Record<string, unknown>) {
  return pipe.transform(body, { type: 'body', metatype: AdminCreateMemberDto, data: undefined });
}

async function messagesFor(body: Record<string, unknown>): Promise<string[]> {
  try {
    await run(body);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as { message: string[] };
    return response.message;
  }
  return [];
}

const minimal = { firstName: 'Juan', lastName: 'Dela Cruz', encounterType: 'ME', classNumber: '18' };

describe('AdminCreateMemberDto', () => {
  it('accepts the four required fields alone', async () => {
    await expect(run(minimal)).resolves.toBeInstanceOf(AdminCreateMemberDto);
  });

  it('accepts blank optional email / phone / ministry start date', async () => {
    await expect(run({ ...minimal, email: '', phone: '', ministryStartDate: '' })).resolves.toBeDefined();
  });

  it.each(['role', 'passwordHash', 'password', 'isActive', 'communityId', 'photoUrl', 'adminActivationRequired'])(
    'rejects the forbidden field %s',
    async (field) => {
      const messages = await messagesFor({ ...minimal, [field]: field === 'isActive' ? false : 'x' });
      expect(messages.join(' ')).toContain(`property ${field} should not exist`);
    },
  );

  it('requires first and last name, encounter type and class', async () => {
    const messages = (await messagesFor({ firstName: '   ' })).join(' | ');
    expect(messages).toMatch(/firstName must not be blank/);
    expect(messages).toMatch(/lastName/);
    expect(messages).toMatch(/encounterType/);
    expect(messages).toMatch(/Class number must be 1 to 3 digits/);
  });

  it('rejects an unknown encounter type and a non-numeric class', async () => {
    const messages = (await messagesFor({ ...minimal, encounterType: 'XX', classNumber: '1a' })).join(' | ');
    expect(messages).toMatch(/encounterType/);
    expect(messages).toMatch(/Class number/);
  });

  it('rejects a malformed mobile with the standard message', async () => {
    const messages = await messagesFor({ ...minimal, phone: '0917123' });
    expect(messages).toContain('Phone must be 11 digits starting with 09 (e.g., 09209648523)');
  });

  it('rejects an invalid email and a malformed ministry start date', async () => {
    const messages = (await messagesFor({ ...minimal, email: 'nope', ministryStartDate: '11/01/2026' })).join(' | ');
    expect(messages).toMatch(/email/);
    expect(messages).toMatch(/YYYY-MM-DD/);
  });

  it('rejects a ministry that does not belong to the apostolate', async () => {
    const messages = (
      await messagesFor({ ...minimal, apostolate: 'Pastoral Apostolate', ministry: 'Praise Ministry' })
    ).join(' | ');
    expect(messages).toMatch(/does not belong to apostolate/);
  });
});
