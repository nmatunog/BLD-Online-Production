import { describe, expect, it, vi } from 'vitest';
import {
  ID_PHOTO_CAMERA_CONSTRAINTS,
  cameraFailureMessage,
  cameraFailureReason,
  requestIdPhotoCameraStream,
} from './id-photo-camera';
import { ID_PHOTO_CAMERA_DENIED_MESSAGE } from './id-photo';

describe('ID_PHOTO_CAMERA_CONSTRAINTS', () => {
  it('asks for at least 1280×720 on the first attempt', () => {
    const video = ID_PHOTO_CAMERA_CONSTRAINTS[0].video as MediaTrackConstraints;
    expect(video.width).toEqual({ ideal: 1280 });
    expect(video.height).toEqual({ ideal: 720 });
  });

  it('falls back to any camera if facingMode/resolution is refused', () => {
    expect(ID_PHOTO_CAMERA_CONSTRAINTS.at(-1)).toEqual({ video: true });
  });
});

describe('cameraFailureReason', () => {
  it('maps permission errors to camera_denied', () => {
    expect(cameraFailureReason({ name: 'NotAllowedError' })).toBe('camera_denied');
    expect(cameraFailureReason({ name: 'PermissionDeniedError' })).toBe('camera_denied');
    expect(cameraFailureMessage('camera_denied')).toBe(ID_PHOTO_CAMERA_DENIED_MESSAGE);
  });

  it('maps missing hardware to camera_unavailable', () => {
    expect(cameraFailureReason({ name: 'NotFoundError' })).toBe('camera_unavailable');
    expect(cameraFailureReason(new Error('fail'))).toBe('camera_unavailable');
  });
});

describe('requestIdPhotoCameraStream', () => {
  it('returns the first successful stream', async () => {
    const stream = { id: 'ok' } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    await expect(requestIdPhotoCameraStream(getUserMedia)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('retries with simpler constraints when resolution fails', async () => {
    const stream = { id: 'fallback' } as unknown as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('overconstrained'), { name: 'OverconstrainedError' }))
      .mockResolvedValueOnce(stream);
    await expect(requestIdPhotoCameraStream(getUserMedia)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('does not keep retrying after the user denies permission', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const getUserMedia = vi.fn().mockRejectedValue(denied);
    await expect(requestIdPhotoCameraStream(getUserMedia)).rejects.toBe(denied);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
