import sharp from 'sharp';

/** Reject source images whose shorter side is below this (pixels). */
export const ID_PHOTO_MIN_SHORT_SIDE = 600;

/** Stored ID photo size (square). */
export const ID_PHOTO_OUTPUT_SIZE = 600;

/** JPEG quality for stored ID photos. */
export const ID_PHOTO_JPEG_QUALITY = 82;

export const ID_PHOTO_TOO_SMALL_MESSAGE = 'Photo too small — use a clearer photo';

export class IdPhotoTooSmallError extends Error {
  constructor(message = ID_PHOTO_TOO_SMALL_MESSAGE) {
    super(message);
    this.name = 'IdPhotoTooSmallError';
  }
}

/**
 * Decode an ID photo, center-crop to 1:1, resize to 600×600, encode JPEG ~q82.
 * Strips metadata (sharp does not copy EXIF unless withMetadata() is used).
 */
export async function normalizeIdPhoto(input: Buffer): Promise<Buffer> {
  if (!input?.length) {
    throw new Error('Photo file is empty');
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { failOn: 'none' }).rotate().metadata();
  } catch {
    throw new Error('Could not read photo');
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error('Could not read photo dimensions');
  }

  if (Math.min(width, height) < ID_PHOTO_MIN_SHORT_SIDE) {
    throw new IdPhotoTooSmallError();
  }

  try {
    return await sharp(input, { failOn: 'none' })
      .rotate()
      .resize(ID_PHOTO_OUTPUT_SIZE, ID_PHOTO_OUTPUT_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({
        quality: ID_PHOTO_JPEG_QUALITY,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer();
  } catch {
    throw new Error('Could not process photo');
  }
}
