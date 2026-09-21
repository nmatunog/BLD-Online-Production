/** Client-side ID photo capture rules. Server still normalizes to 600×600 JPEG. */

export const ID_PHOTO_MIN_SHORT_SIDE = 600;

/** Send a square a bit larger than the stored size; backend resizes to 600. */
export const ID_PHOTO_CLIENT_OUTPUT_SIZE = 800;

export const ID_PHOTO_TOO_SMALL_MESSAGE = 'Photo too small — use a clearer photo';

export function isPhotoTooSmall(width: number, height: number): boolean {
  return Math.min(width, height) < ID_PHOTO_MIN_SHORT_SIDE;
}
