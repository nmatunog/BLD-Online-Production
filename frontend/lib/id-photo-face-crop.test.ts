import { describe, expect, it } from 'vitest';
import { ID_PHOTO_MIN_SHORT_SIDE } from './id-photo';
import {
  FACE_CENTER_Y_IN_CROP,
  FACE_HEIGHT_IN_CROP,
  FACE_SCORE_THRESHOLD,
  ID_PHOTO_CROP_MAX_ZOOM,
  NO_FACE_CROP_TIP,
  centerSquareCrop,
  idPhotoCropFromFace,
  pickPrimaryFace,
  resolveInitialIdPhotoCrop,
  type FaceBox,
} from './id-photo-face-crop';

function containsFace(crop: { x: number; y: number; width: number; height: number }, face: FaceBox) {
  const faceRight = face.x + face.width;
  const faceBottom = face.y + face.height;
  const cropRight = crop.x + crop.width;
  const cropBottom = crop.y + crop.height;
  return face.x >= crop.x && face.y >= crop.y && faceRight <= cropRight && faceBottom <= cropBottom;
}

describe('centerSquareCrop', () => {
  it('returns a centered square on landscape', () => {
    expect(centerSquareCrop(2000, 1000)).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it('returns a centered square on portrait', () => {
    expect(centerSquareCrop(600, 1000)).toEqual({ x: 0, y: 200, width: 600, height: 600 });
  });

  it('returns the full image when already square', () => {
    expect(centerSquareCrop(800, 800)).toEqual({ x: 0, y: 0, width: 800, height: 800 });
  });
});

describe('idPhotoCropFromFace', () => {
  it('frames a centered face with head toward the top third and a square crop', () => {
    const imageWidth = 2000;
    const imageHeight = 2000;
    const face: FaceBox = { x: 800, y: 500, width: 400, height: 500, score: 0.95 };
    const crop = idPhotoCropFromFace(imageWidth, imageHeight, face);

    expect(crop.width).toBe(crop.height);
    expect(containsFace(crop, face)).toBe(true);

    const expectedSide = face.height / FACE_HEIGHT_IN_CROP;
    expect(crop.width).toBeCloseTo(expectedSide, 0);

    const faceCenterX = face.x + face.width / 2;
    const cropCenterX = crop.x + crop.width / 2;
    expect(Math.abs(cropCenterX - faceCenterX)).toBeLessThanOrEqual(1);

    const faceCenterY = face.y + face.height / 2;
    const faceCenterYInCrop = (faceCenterY - crop.y) / crop.height;
    expect(faceCenterYInCrop).toBeCloseTo(FACE_CENTER_Y_IN_CROP, 1);

    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(imageWidth);
    expect(crop.y + crop.height).toBeLessThanOrEqual(imageHeight);
  });

  it('shifts left for a face on the left of a landscape group photo', () => {
    const imageWidth = 2400;
    const imageHeight = 1000;
    const face: FaceBox = { x: 80, y: 220, width: 180, height: 240, score: 0.92 };
    const crop = idPhotoCropFromFace(imageWidth, imageHeight, face);

    expect(crop.width).toBe(crop.height);
    expect(crop.width).toBeGreaterThanOrEqual(ID_PHOTO_MIN_SHORT_SIDE);
    expect(crop.x).toBeLessThan(imageWidth / 2);
    expect(crop.x).toBe(0);
    expect(containsFace(crop, face)).toBe(true);
    const center = centerSquareCrop(imageWidth, imageHeight);
    expect(crop.x).toBeLessThan(center.x);
  });

  it('clamps a face near the top so the crop stays in-bounds', () => {
    const imageWidth = 1200;
    const imageHeight = 1200;
    const face: FaceBox = { x: 500, y: 10, width: 200, height: 180, score: 0.9 };
    const crop = idPhotoCropFromFace(imageWidth, imageHeight, face);

    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(imageWidth);
    expect(crop.y + crop.height).toBeLessThanOrEqual(imageHeight);
    expect(containsFace(crop, face)).toBe(true);
  });

  it('does not zoom past the cropper max zoom for a tiny face', () => {
    const imageWidth = 1800;
    const imageHeight = 1200;
    const face: FaceBox = { x: 800, y: 500, width: 40, height: 50, score: 0.88 };
    const crop = idPhotoCropFromFace(imageWidth, imageHeight, face);
    const minSide = Math.min(imageWidth, imageHeight);
    const minCropSide = minSide / ID_PHOTO_CROP_MAX_ZOOM;

    expect(crop.width).toBeGreaterThanOrEqual(Math.max(Math.floor(minCropSide), ID_PHOTO_MIN_SHORT_SIDE));
    expect(crop.width).toBeLessThanOrEqual(minSide);
  });

  it('never initializes a crop smaller than 600px when the image can supply it', () => {
    const imageWidth = 2400;
    const imageHeight = 1000;
    const face: FaceBox = { x: 80, y: 220, width: 180, height: 240, score: 0.92 };
    const crop = idPhotoCropFromFace(imageWidth, imageHeight, face);
    expect(crop.width).toBeGreaterThanOrEqual(ID_PHOTO_MIN_SHORT_SIDE);
    expect(crop.height).toBeGreaterThanOrEqual(ID_PHOTO_MIN_SHORT_SIDE);
    expect(containsFace(crop, face)).toBe(true);
  });

  it('falls back to a centered square when the box is unusable', () => {
    expect(idPhotoCropFromFace(1000, 800, { x: 0, y: 0, width: 0, height: 0 })).toEqual(
      centerSquareCrop(1000, 800),
    );
  });
});

describe('pickPrimaryFace', () => {
  it('returns the largest face above the score threshold', () => {
    const faces: FaceBox[] = [
      { x: 10, y: 10, width: 80, height: 80, score: 0.95 },
      { x: 400, y: 40, width: 200, height: 240, score: 0.82 },
      { x: 20, y: 20, width: 300, height: 300, score: 0.4 },
    ];
    const picked = pickPrimaryFace(faces);
    expect(picked).toEqual(faces[1]);
  });

  it('returns null when every face is below the threshold', () => {
    expect(
      pickPrimaryFace([{ x: 0, y: 0, width: 100, height: 100, score: FACE_SCORE_THRESHOLD - 0.2 }]),
    ).toBeNull();
  });
});

describe('resolveInitialIdPhotoCrop', () => {
  it('uses face framing when a box is present', () => {
    const face: FaceBox = { x: 100, y: 120, width: 200, height: 240, score: 0.9 };
    const result = resolveInitialIdPhotoCrop(1600, 1200, face);
    expect(result.usedFace).toBe(true);
    expect(result.crop).toEqual(idPhotoCropFromFace(1600, 1200, face));
  });

  it('uses P1 center crop when there is no face', () => {
    const result = resolveInitialIdPhotoCrop(1600, 900, null);
    expect(result.usedFace).toBe(false);
    expect(result.crop).toEqual(centerSquareCrop(1600, 900));
    expect(NO_FACE_CROP_TIP).toMatch(/Couldn.t find a face/);
  });
});
