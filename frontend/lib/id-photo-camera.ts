import {
  ID_PHOTO_CAMERA_DENIED_MESSAGE,
  ID_PHOTO_CAMERA_UNAVAILABLE_MESSAGE,
  type IdPhotoClientFailReason,
} from './id-photo';

/** Prefer HD; browsers treat these as ideals and may still deliver 640×480. */
export const ID_PHOTO_CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: { ideal: 'user' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  { video: { facingMode: 'user' } },
  { video: true },
];

export function cameraFailureReason(error: unknown): Extract<
  IdPhotoClientFailReason,
  'camera_denied' | 'camera_unavailable'
> {
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'camera_denied';
  }
  return 'camera_unavailable';
}

export function cameraFailureMessage(reason: ReturnType<typeof cameraFailureReason>): string {
  return reason === 'camera_denied'
    ? ID_PHOTO_CAMERA_DENIED_MESSAGE
    : ID_PHOTO_CAMERA_UNAVAILABLE_MESSAGE;
}

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

export async function requestIdPhotoCameraStream(
  getUserMedia?: GetUserMedia,
): Promise<MediaStream> {
  const request =
    getUserMedia ??
    (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      : undefined);

  if (!request) {
    const err = new Error('Camera API is not available');
    err.name = 'NotFoundError';
    throw err;
  }

  let lastError: unknown;
  for (const constraints of ID_PHOTO_CAMERA_CONSTRAINTS) {
    try {
      return await request(constraints);
    } catch (error) {
      lastError = error;
      if (cameraFailureReason(error) === 'camera_denied') {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to access camera');
}
