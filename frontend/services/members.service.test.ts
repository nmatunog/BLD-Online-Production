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

import {
  buildMemberPhotoUploadBody,
  getMemberApiErrorMessage,
  membersService,
  PHOTO_UPLOAD_TIMEOUT_MS,
} from './members.service';

const PHOTO_DATA_URL = 'data:image/jpeg;base64,YQ==';

function postedForm(callIndex = 0): FormData {
  const body = post.mock.calls[callIndex]?.[1];
  expect(body).toBeInstanceOf(FormData);
  return body as FormData;
}

describe('PHOTO_UPLOAD_TIMEOUT_MS', () => {
  it('is at least 60s so rembg/normalize is not aborted by the 10s axios default', () => {
    expect(PHOTO_UPLOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
    expect(PHOTO_UPLOAD_TIMEOUT_MS).toBe(60_000);
  });
});

describe('buildMemberPhotoUploadBody', () => {
  it('prefers multipart field name file for a JPEG data URL', () => {
    const body = buildMemberPhotoUploadBody(PHOTO_DATA_URL);
    expect(body).toBeInstanceOf(FormData);
    const file = (body as FormData).get('file');
    expect(file).toBeInstanceOf(Blob);
    expect((file as Blob).type).toBe('image/jpeg');
  });

  it('falls back to JSON photoDataUrl when the payload is not a data URL', () => {
    expect(buildMemberPhotoUploadBody('not-a-data-url')).toEqual({
      photoDataUrl: 'not-a-data-url',
    });
  });
});

describe('getMemberApiErrorMessage', () => {
  it('prefers the server message when present', () => {
    expect(
      getMemberApiErrorMessage(
        {
          response: {
            status: 400,
            data: { message: 'Photo is too large (max 2.5 MB after processing)' },
          },
          message: 'Request failed with status code 400',
        },
        'Failed to upload photo',
      ),
    ).toBe('Photo is too large (max 2.5 MB after processing)');
  });

  it('prefers the server message even on 401', () => {
    expect(
      getMemberApiErrorMessage(
        {
          response: { status: 401, data: { message: 'Invalid token' } },
          message: 'Request failed with status code 401',
        },
        'Failed to upload photo',
      ),
    ).toBe('Invalid token');
  });

  it('uses the session-expired copy for a bare Axios 401', () => {
    expect(
      getMemberApiErrorMessage(
        { response: { status: 401, data: {} }, message: 'Request failed with status code 401' },
        'Failed to upload photo',
      ),
    ).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it('stringifies a nested object message instead of [object Object]', () => {
    expect(
      getMemberApiErrorMessage(
        {
          response: {
            status: 400,
            data: { message: { message: 'Could not process photo', statusCode: 400 } },
          },
          message: 'Request failed with status code 400',
        },
        'Failed to upload photo',
      ),
    ).toBe('Could not process photo');
  });
});

describe('membersService photo upload', () => {
  beforeEach(() => {
    ensureFreshToken.mockReset();
    post.mockReset();
    ensureFreshToken.mockResolvedValue('fresh-token');
    post.mockResolvedValue({
      data: { success: true, data: { photoUrl: 'https://cdn.example/photo.jpg' } },
    });
  });

  it('refreshes the access token before admin multipart photo POST', async () => {
    const order: string[] = [];
    ensureFreshToken.mockImplementation(async () => {
      order.push('fresh');
      return 'fresh-token';
    });
    post.mockImplementation(async () => {
      order.push('post');
      return { data: { success: true, data: { photoUrl: 'https://cdn.example/photo.jpg' } } };
    });

    await expect(membersService.uploadMemberPhoto('member-1', PHOTO_DATA_URL)).resolves.toBe(
      'https://cdn.example/photo.jpg',
    );
    expect(order).toEqual(['fresh', 'post']);
    expect(post).toHaveBeenCalledWith(
      '/members/member-1/photo',
      expect.any(FormData),
      { timeout: PHOTO_UPLOAD_TIMEOUT_MS },
    );
    expect(postedForm().get('file')).toBeInstanceOf(Blob);
  });

  it('refreshes the access token before self multipart photo POST', async () => {
    await membersService.uploadMyPhoto(PHOTO_DATA_URL);
    expect(ensureFreshToken).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/members/me/photo',
      expect.any(FormData),
      { timeout: PHOTO_UPLOAD_TIMEOUT_MS },
    );
    expect(postedForm().get('file')).toBeInstanceOf(Blob);
  });

  it('surfaces a clear session-expired error and does not POST when refresh fails', async () => {
    ensureFreshToken.mockRejectedValue(new Error(SESSION_EXPIRED_MESSAGE));

    await expect(membersService.uploadMemberPhoto('member-1', PHOTO_DATA_URL)).rejects.toThrow(
      SESSION_EXPIRED_MESSAGE,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('maps a leftover Axios 401 to the session-expired message', async () => {
    const axios401 = Object.assign(new Error('Request failed with status code 401'), {
      response: { status: 401, data: {} },
    });
    post.mockRejectedValue(axios401);

    await expect(membersService.uploadMyPhoto(PHOTO_DATA_URL)).rejects.toThrow(
      SESSION_EXPIRED_MESSAGE,
    );
  });

  it('surfaces the server message on a failed photo save', async () => {
    post.mockRejectedValue({
      response: { status: 400, data: { message: 'Photo file or photoDataUrl is required' } },
      message: 'Request failed with status code 400',
    });

    await expect(membersService.uploadMemberPhoto('member-1', PHOTO_DATA_URL)).rejects.toThrow(
      'Photo file or photoDataUrl is required',
    );
  });

  it('does not throw Error: [object Object] when the API error field is an object', async () => {
    post.mockResolvedValue({
      data: { success: false, error: { statusCode: 400, message: 'Could not process photo' } },
    });

    await expect(membersService.uploadMemberPhoto('member-1', PHOTO_DATA_URL)).rejects.toThrow(
      'Could not process photo',
    );
  });
});
