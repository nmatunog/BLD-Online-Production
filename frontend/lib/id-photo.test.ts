import { describe, expect, it } from 'vitest';
import {
  ID_PHOTO_MIN_SHORT_SIDE,
  ID_PHOTO_PREFERRED_SHORT_SIDE,
  ID_PHOTO_ZOOM_HARD_CAP,
  idPhotoMaxZoom,
  idPhotoMinCropSide,
  isPhotoLowResolution,
  isPhotoTooSmall,
} from './id-photo';

describe('isPhotoTooSmall', () => {
  it('rejects below the 400px short-side floor', () => {
    expect(isPhotoTooSmall(399, 800)).toBe(true);
    expect(isPhotoTooSmall(320, 240)).toBe(true);
  });

  it('accepts a 640×480 webcam frame', () => {
    expect(isPhotoTooSmall(640, 480)).toBe(false);
  });

  it('accepts a 400px short side', () => {
    expect(isPhotoTooSmall(400, 500)).toBe(false);
  });
});

describe('isPhotoLowResolution', () => {
  it('hints when the short side is between 400 and 600', () => {
    expect(isPhotoLowResolution(640, 480)).toBe(true);
    expect(isPhotoLowResolution(500, 500)).toBe(true);
    expect(isPhotoLowResolution(400, 800)).toBe(true);
  });

  it('does not hint at or above the preferred size', () => {
    expect(isPhotoLowResolution(600, 800)).toBe(false);
    expect(isPhotoLowResolution(1080, 1920)).toBe(false);
  });

  it('does not hint for photos that are still too small', () => {
    expect(isPhotoLowResolution(320, 240)).toBe(false);
  });
});

describe('idPhotoMaxZoom', () => {
  it('caps a 640×480 webcam so the crop stays at least 400px', () => {
    expect(idPhotoMaxZoom(640, 480)).toBeCloseTo(480 / ID_PHOTO_MIN_SHORT_SIDE, 5);
    expect(idPhotoMinCropSide(640, 480)).toBeCloseTo(400, 5);
  });

  it('caps a ~1080px phone photo below 3× so zoom cannot go under 400px', () => {
    const maxZoom = idPhotoMaxZoom(1080, 1920);
    expect(maxZoom).toBeCloseTo(1080 / 400, 5);
    expect(maxZoom).toBeLessThan(ID_PHOTO_ZOOM_HARD_CAP);
    expect(1080 / maxZoom).toBeCloseTo(ID_PHOTO_MIN_SHORT_SIDE, 5);
  });

  it('never exceeds 3× on a large photo', () => {
    expect(idPhotoMaxZoom(4000, 3000)).toBe(ID_PHOTO_ZOOM_HARD_CAP);
    expect(idPhotoMinCropSide(4000, 3000)).toBe(3000 / ID_PHOTO_ZOOM_HARD_CAP);
  });

  it('stays at 1× when the short side is exactly the floor', () => {
    expect(idPhotoMaxZoom(400, 600)).toBe(1);
    expect(idPhotoMinCropSide(400, 600)).toBe(400);
  });
});

describe('preferred vs minimum constants', () => {
  it('keeps the 600px stored size as a preference, not a client floor', () => {
    expect(ID_PHOTO_MIN_SHORT_SIDE).toBe(400);
    expect(ID_PHOTO_PREFERRED_SHORT_SIDE).toBe(600);
  });
});
