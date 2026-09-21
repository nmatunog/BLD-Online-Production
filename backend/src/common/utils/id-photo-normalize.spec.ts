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

  it('applies EXIF orientation before 1:1 normalize', async () => {
    const leftRedRightBlue = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 24, b: 24 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 450, height: 600, channels: 3, background: { r: 24, g: 48, b: 200 } },
          })
            .png()
            .toBuffer(),
          left: 450,
          top: 0,
        },
      ])
      .jpeg({ quality: 95 })
      .toBuffer();

    const withExif = await sharp(leftRedRightBlue)
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 95 })
      .toBuffer();

    const tagged = await sharp(withExif).metadata();
    expect(tagged.orientation).toBe(6);

    const out = await normalizeIdPhoto(withExif);
    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(ID_PHOTO_OUTPUT_SIZE);
    expect(info.height).toBe(ID_PHOTO_OUTPUT_SIZE);

    const channels = info.channels ?? 3;
    const pixel = (x: number, y: number) => {
      const i = (y * info.width! + x) * channels;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    };

    // Orientation 6 = 90° CW, so original left (red) becomes the top of the frame.
    const midTop = pixel(300, 40);
    const midBottom = pixel(300, 560);
    expect(midTop.r).toBeGreaterThan(midTop.b);
    expect(midBottom.b).toBeGreaterThan(midBottom.r);
  });
});
