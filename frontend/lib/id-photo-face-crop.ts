/** Pixel rectangle in original-image coordinates (same shape as react-easy-crop Area). */
export type PixelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FaceBox = PixelBox & {
  score?: number;
};

/** Soft copy when detection finds no usable face. */
export const NO_FACE_CROP_TIP = "Couldn't find a face — drag to center your face.";

/** Minimum detector score before we trust a box. */
export const FACE_SCORE_THRESHOLD = 0.7;

/**
 * Face height as a fraction of the square crop.
 * ~46% leaves room above the head and shoulder room below (ID-photo framing).
 */
export const FACE_HEIGHT_IN_CROP = 0.46;

/** Face center as a fraction from the top of the crop (head in the upper third). */
export const FACE_CENTER_Y_IN_CROP = 0.38;

/** Matches the cropper zoom slider so initial framing is reachable by drag/zoom. */
export const ID_PHOTO_CROP_MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function roundBox(box: PixelBox): PixelBox {
  const x = Math.round(box.x);
  const y = Math.round(box.y);
  const width = Math.max(1, Math.round(box.width));
  const height = Math.max(1, Math.round(box.height));
  return { x, y, width, height };
}

/** Largest square that fits in the image, centered — P1 fallback. */
export function centerSquareCrop(imageWidth: number, imageHeight: number): PixelBox {
  const width = Math.max(0, imageWidth);
  const height = Math.max(0, imageHeight);
  const side = Math.min(width, height);
  if (side <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return roundBox({
    x: (width - side) / 2,
    y: (height - side) / 2,
    width: side,
    height: side,
  });
}

function clampFaceToImage(face: FaceBox, imageWidth: number, imageHeight: number): FaceBox | null {
  const x = clamp(face.x, 0, imageWidth);
  const y = clamp(face.y, 0, imageHeight);
  const width = clamp(face.width, 0, imageWidth - x);
  const height = clamp(face.height, 0, imageHeight - y);
  if (width < 2 || height < 2) return null;
  return { ...face, x, y, width, height };
}

/**
 * Square crop framed for an ID photo from a face bounding box.
 * Horizontally centered on the face; vertically places the head near the top third
 * with shoulder room below. Clamped to the image. Zoom is capped at maxZoom.
 */
export function idPhotoCropFromFace(
  imageWidth: number,
  imageHeight: number,
  face: FaceBox,
  options?: { maxZoom?: number },
): PixelBox {
  const fallback = centerSquareCrop(imageWidth, imageHeight);
  if (imageWidth < 2 || imageHeight < 2) return fallback;

  const clampedFace = clampFaceToImage(face, imageWidth, imageHeight);
  if (!clampedFace) return fallback;

  const maxZoom = options?.maxZoom ?? ID_PHOTO_CROP_MAX_ZOOM;
  const minSide = Math.min(imageWidth, imageHeight);
  const minCropSide = minSide / Math.max(1, maxZoom);

  const faceCenterX = clampedFace.x + clampedFace.width / 2;
  const faceCenterY = clampedFace.y + clampedFace.height / 2;
  const desiredSide = clampedFace.height / FACE_HEIGHT_IN_CROP;
  const side = clamp(desiredSide, minCropSide, minSide);

  const x = clamp(faceCenterX - side / 2, 0, imageWidth - side);
  const y = clamp(faceCenterY - side * FACE_CENTER_Y_IN_CROP, 0, imageHeight - side);

  return roundBox({ x, y, width: side, height: side });
}

/** Highest-confidence face that also has the largest box (group photos). */
export function pickPrimaryFace(
  faces: FaceBox[],
  minScore: number = FACE_SCORE_THRESHOLD,
): FaceBox | null {
  const usable = faces.filter((face) => {
    const score = face.score ?? 0;
    return score >= minScore && face.width > 1 && face.height > 1;
  });
  if (usable.length === 0) return null;
  return usable.reduce((best, face) => {
    const bestArea = best.width * best.height;
    const area = face.width * face.height;
    if (area > bestArea) return face;
    if (area === bestArea && (face.score ?? 0) > (best.score ?? 0)) return face;
    return best;
  });
}

export function resolveInitialIdPhotoCrop(
  imageWidth: number,
  imageHeight: number,
  face: FaceBox | null,
): { crop: PixelBox; usedFace: boolean } {
  if (!face) {
    return { crop: centerSquareCrop(imageWidth, imageHeight), usedFace: false };
  }
  return {
    crop: idPhotoCropFromFace(imageWidth, imageHeight, face),
    usedFace: true,
  };
}
