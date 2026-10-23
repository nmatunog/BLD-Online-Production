import { ForbiddenException } from '@nestjs/common';
import { AttendanceMonitoringService } from './attendance-monitoring.service';

describe('AttendanceMonitoringService auth', () => {
  const service = new AttendanceMonitoringService({} as never);

  it('rejects MEMBER role before querying data', async () => {
    await expect(service.getReport({ year: 2026, month: 10 }, { role: 'MEMBER' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects unauthenticated callers', async () => {
    await expect(service.getReport({ year: 2026 }, { role: null })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
