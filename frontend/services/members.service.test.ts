import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_EXPIRED_MESSAGE } from './api-client-token';

const { ensureFreshToken, post } = vi.hoisted(() => ({
  ensureFreshToken: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./api-client', () => ({
  apiClient: {
    ensureFreshToken,
    post,
  },
}));

import { membersService, PHOTO_UPLOAD_TIMEOUT_MS } from './members.service';

describe('PHOTO_UPLOAD_TIMEOUT_MS', () => {
  it('is at least 60s so rembg/normalize is not aborted by the 10s axios default', () => {
    expect(PHOTO_UPLOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
    expect(PHOTO_UPLOAD_TIMEOUT_MS).toBe(60_000);
  });
});

describe('membersService photo upload', () => {
  const photoDataUrl = 'data:image/jpeg;base64,abc123';

  beforeEach(() => {
    ensureFreshToken.mockReset();
    post.mockReset();
    ensureFreshToken.mockResolvedValue('fresh-token');
    post.mockResolvedValue({
      data: { success: true, data: { photoUrl: 'https://cdn.example/photo.jpg' } },
    });
  });

  it('refreshes the access token before admin photo POST', async () => {
    const order: string[] = [];
    ensureFreshToken.mockImplementation(async () => {
      order.push('fresh');
      return 'fresh-token';
    });
    post.mockImplementation(async () => {
      order.push('post');
      return { data: { success: true, data: { photoUrl: 'https://cdn.example/photo.jpg' } } };
    });

    await expect(membersService.uploadMemberPhoto('member-1', photoDataUrl)).resolves.toBe(
      'https://cdn.example/photo.jpg',
    );
    expect(order).toEqual(['fresh', 'post']);
    expect(post).toHaveBeenCalledWith(
      '/members/member-1/photo',
      { photoDataUrl },
      { timeout: PHOTO_UPLOAD_TIMEOUT_MS },
    );
  });

  it('refreshes the access token before self photo POST', async () => {
    await membersService.uploadMyPhoto(photoDataUrl);
    expect(ensureFreshToken).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/members/me/photo',
      { photoDataUrl },
      { timeout: PHOTO_UPLOAD_TIMEOUT_MS },
    );
  });

  it('surfaces a clear session-expired error and does not POST when refresh fails', async () => {
    ensureFreshToken.mockRejectedValue(new Error(SESSION_EXPIRED_MESSAGE));

    await expect(membersService.uploadMemberPhoto('member-1', photoDataUrl)).rejects.toThrow(
      SESSION_EXPIRED_MESSAGE,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('maps a leftover Axios 401 to the session-expired message', async () => {
    const axios401 = Object.assign(new Error('Request failed with status code 401'), {
      response: { status: 401, data: {} },
    });
    post.mockRejectedValue(axios401);

    await expect(membersService.uploadMyPhoto(photoDataUrl)).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
  });
});
