import sharp from 'sharp';
import {
  normalizeIdPhoto,
  IdPhotoTooSmallError,
  ID_PHOTO_OUTPUT_SIZE,
  ID_PHOTO_TOO_SMALL_MESSAGE,
} from './id-photo-normalize';

async function solidJpeg(width: number, height: number, color = { r: 32, g: 96, b: 176 }): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe('normalizeIdPhoto', () => {
  it('center-crops landscape to 600×600 JPEG', async () => {
    const src = await solidJpeg(900, 600);
    const out = await normalizeIdPhoto(src);
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(ID_PHOTO_OUTPUT_SIZE);
    expect(meta.height).toBe(ID_PHOTO_OUTPUT_SIZE);
    expect(out.length).toBeGreaterThan(0);
  });

  it('center-crops portrait to 600×600 JPEG', async () => {
    const src = await solidJpeg(600, 1000);
    const out = await normalizeIdPhoto(src);
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(ID_PHOTO_OUTPUT_SIZE);
    expect(meta.height).toBe(ID_PHOTO_OUTPUT_SIZE);
  });

  it('rejects images whose shorter side is below 600px', async () => {
    const src = await solidJpeg(400, 500);
    await expect(normalizeIdPhoto(src)).rejects.toBeInstanceOf(IdPhotoTooSmallError);
    await expect(normalizeIdPhoto(src)).rejects.toThrow(ID_PHOTO_TOO_SMALL_MESSAGE);
  });

  it('rejects a square image that is just under 600px', async () => {
    const src = await solidJpeg(599, 599);
    await expect(normalizeIdPhoto(src)).rejects.toThrow(ID_PHOTO_TOO_SMALL_MESSAGE);
  });
});
