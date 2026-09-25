/** Client-side ID photo capture rules. Server still normalizes to 600×600 JPEG. */

/** Reject sources/crops whose shorter side is below this (pixels). */
export const ID_PHOTO_MIN_SHORT_SIDE = 400;

/**
 * Preferred short side. Photos between MIN and this are accepted with a
 * low-resolution hint; the server upscales the stored 600×600 JPEG.
 */
export const ID_PHOTO_PREFERRED_SHORT_SIDE = 600;

/** Hard cap for the cropper zoom slider. */
export const ID_PHOTO_ZOOM_HARD_CAP = 3;

/** Send a square a bit larger than the stored size; backend resizes to 600. */
export const ID_PHOTO_CLIENT_OUTPUT_SIZE = 800;

export const ID_PHOTO_TOO_SMALL_MESSAGE = 'Photo too small — use a clearer photo';

export const ID_PHOTO_TOO_SMALL_HINT =
  'Use a photo at least 400 pixels on the shorter side. A 640×480 webcam photo is fine.';

export const ID_PHOTO_LOW_RES_HINT =
  'This photo is a bit low-resolution. You can still use it — a clearer photo will look sharper on your ID.';

export const ID_PHOTO_HEIC_MESSAGE =
  "This photo is in Apple HEIC format, which this browser can't open. On iPhone, go to Settings → Camera → Formats → Most Compatible, or choose a JPEG/PNG, then try again.";

export const ID_PHOTO_CAMERA_DENIED_MESSAGE =
  'Camera permission was denied. Allow camera access in the browser, or upload a file instead.';

export const ID_PHOTO_CAMERA_UNAVAILABLE_MESSAGE =
  'Unable to access a camera. Plug in a webcam, close other apps using it, or upload a file instead.';

/** Shown near crop confirm; server applies white-BG cleanup on upload. */
export const ID_PHOTO_WHITE_BG_HINT = "We'll clean up the background for your ID.";

export type IdPhotoClientFlow = 'signup' | 'profile' | 'admin';

export type IdPhotoClientFailReason =
  | 'too_small'
  | 'heic_decode'
  | 'decode'
  | 'camera_denied'
  | 'camera_unavailable'
  | 'load_error';

export function shortSide(width: number, height: number): number {
  return Math.min(width, height);
}

export function isPhotoTooSmall(width: number, height: number): boolean {
  return shortSide(width, height) < ID_PHOTO_MIN_SHORT_SIDE;
}

/** Accepted, but below the preferred 600px short side. */
export function isPhotoLowResolution(width: number, height: number): boolean {
  const side = shortSide(width, height);
  return side >= ID_PHOTO_MIN_SHORT_SIDE && side < ID_PHOTO_PREFERRED_SHORT_SIDE;
}

/**
 * Max crop zoom so the visible square never drops below the 400px floor.
 * Never above 3×. A 640×480 webcam (short side 480) caps at 1.2×.
 */
export function idPhotoMaxZoom(width: number, height: number): number {
  const side = shortSide(width, height);
  if (side <= 0) return 1;
  return Math.max(1, Math.min(ID_PHOTO_ZOOM_HARD_CAP, side / ID_PHOTO_MIN_SHORT_SIDE));
}

/** Smallest crop side the zoom slider can produce for this image. */
export function idPhotoMinCropSide(width: number, height: number): number {
  const side = shortSide(width, height);
  if (side <= 0) return 0;
  return Math.min(side, Math.max(ID_PHOTO_MIN_SHORT_SIDE, side / idPhotoMaxZoom(width, height)));
}
