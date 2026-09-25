import { IdPhotoClientEventsService } from './id-photo-client-events.service';

describe('IdPhotoClientEventsService', () => {
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { member: { findUnique: jest.fn() } };

  function service(): IdPhotoClientEventsService {
    return new IdPhotoClientEventsService(jwt as never, prisma as never);
  }

  beforeEach(() => {
    jwt.verifyAsync.mockReset();
    prisma.member.findUnique.mockReset();
  });

  it('rate-limits a noisy IP', () => {
    const svc = service();
    let limited = 0;
    for (let i = 0; i < 25; i++) {
      if (svc.isRateLimited('1.2.3.4', 1_000_000 + i)) limited++;
    }
    expect(limited).toBe(5);
  });

  it('logs without a member id when there is no JWT (signup)', async () => {
    const svc = service();
    const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation();
    await svc.record(
      { reason: 'too_small', flow: 'signup', width: 640, height: 480, mimeType: 'image/jpeg' },
      { ip: '10.0.0.1', userAgent: 'Mozilla/5.0 TestBrowser' },
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason=too_small'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('flow=signup'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('memberId='));
    expect(warn.mock.calls[0][0]).not.toMatch(/data:image|base64/);
    warn.mockRestore();
  });

  it('attaches member id from a valid JWT and ignores a bad token', async () => {
    const svc = service();
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
    prisma.member.findUnique.mockResolvedValueOnce({ id: 'member-9' });
    const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation();

    await svc.record(
      { reason: 'heic_decode', flow: 'profile' },
      { authorization: 'Bearer good-token', userAgent: 'iPhone' },
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('memberId=member-9'));

    jwt.verifyAsync.mockRejectedValueOnce(new Error('bad token'));
    await svc.record({ reason: 'decode', flow: 'admin' }, { authorization: 'Bearer nope' });
    expect(warn.mock.calls[1][0]).toContain('memberId=');
    expect(warn.mock.calls[1][0]).not.toContain('memberId=member-9');
    warn.mockRestore();
  });
});
