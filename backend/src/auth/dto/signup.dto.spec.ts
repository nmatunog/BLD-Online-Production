import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDto } from './signup.dto';

const base = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  encounterType: 'ME',
  classNumber: '18',
  phone: '09171234567',
};

async function nicknameErrors(nickname: unknown): Promise<string[]> {
  const dto = plainToInstance(SignupDto, { ...base, nickname });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === 'nickname').flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('SignupDto nickname', () => {
  it('is required', async () => {
    expect(await nicknameErrors(undefined)).toContain('Nickname is required');
    expect(await nicknameErrors('')).toContain('Nickname is required');
    expect(await nicknameErrors('   ')).toContain('Nickname is required');
  });

  it('accepts a normal nickname and caps the length', async () => {
    expect(await nicknameErrors('Jun')).toEqual([]);
    expect((await nicknameErrors('x'.repeat(61))).length).toBeGreaterThan(0);
  });
});
