import sharp from 'sharp';
import {
  applyWhiteBackground,
  cutoutOpacityStats,
  flattenOnWhite,
  hardenAlphaChannel,
  isRembgU2netpModel,
  isSubjectWashedOut,
  prepareStoredIdPhoto,
  REMBG_U2NETP_SHA256,
} from './id-photo-white-bg';
import { ID_PHOTO_OUTPUT_SIZE, ID_PHOTO_TOO_SMALL_MESSAGE } from './id-photo-normalize';

async function rgbJpeg(
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** Red field with a dark rectangle in the center (synthetic “subject”). */
async function subjectOnRed(size = 600): Promise<Buffer> {
  const subject = 220;
  const offset = Math.round((size - subject) / 2);
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 200, g: 24, b: 24 } },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: subject,
            height: subject,
            channels: 3,
            background: { r: 32, g: 40, b: 48 },
          },
        })
          .png()
          .toBuffer(),
        left: offset,
        top: offset,
      },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** Color-key rembg mock: treat near-red as background (transparent), keep the rest. */
async function colorKeyRedBackground(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const isRedBg = r > 150 && r > g * 2 && r > b * 2;
    data[o + 3] = isRedBg ? 0 : 255;
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function cornerPixel(
  data: Buffer,
  info: { width: number; height: number; channels: number },
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

function expectNearWhite(px: { r: number; g: number; b: number }) {
  expect(px.r).toBeGreaterThan(240);
  expect(px.g).toBeGreaterThan(240);
  expect(px.b).toBeGreaterThan(240);
  expect(Math.abs(px.r - px.g)).toBeLessThan(12);
  expect(Math.abs(px.r - px.b)).toBeLessThan(12);
}

describe('hardenAlphaChannel', () => {
  it('snaps weak alpha to 0 and strong alpha to 255', () => {
    const rgba = Buffer.from([10, 20, 30, 40, 10, 20, 30, 180, 10, 20, 30, 100]);
    hardenAlphaChannel(rgba);
    expect(rgba[3]).toBe(0);
    expect(rgba[7]).toBe(255);
    expect(rgba[11]).toBeGreaterThan(80);
    expect(rgba[11]).toBeLessThan(180);
  });
});

describe('cutoutOpacityStats', () => {
  it('counts strong vs weak opaque pixels', async () => {
    const rgba = Buffer.alloc(4 * 4 * 4, 0);
    rgba[3] = 255;
    rgba[7] = 40;
    const png = await sharp(rgba, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer();
    const stats = await cutoutOpacityStats(png);
    expect(stats.strong).toBeCloseTo(1 / 16, 5);
    expect(stats.weak).toBeCloseTo(2 / 16, 5);
  });
});

describe('isSubjectWashedOut', () => {
  it('detects a solid-alpha cutout whose subject was blended to white', async () => {
    const source = await rgbJpeg(64, 64, { r: 80, g: 70, b: 60 });
    const white = await rgbJpeg(64, 64, { r: 255, g: 255, b: 255 });
    const cutout = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 80, g: 70, b: 60, alpha: 1 } },
    })
      .png()
      .toBuffer();
    await expect(isSubjectWashedOut(source, white, cutout)).resolves.toBe(true);
  });

  it('accepts a clean cutout whose subject color is preserved', async () => {
    const src = await subjectOnRed(640);
    const cutout = await colorKeyRedBackground(src);
    const flat = await flattenOnWhite(cutout);
    await expect(isSubjectWashedOut(src, flat, cutout)).resolves.toBe(false);
  });
});

describe('flattenOnWhite', () => {
  it('composites a transparent PNG onto #FFFFFF', async () => {
    const rgba = Buffer.alloc(4 * 4 * 4, 0);
    // Opaque green pixel at (1,1)
    const i = (1 * 4 + 1) * 4;
    rgba[i] = 10;
    rgba[i + 1] = 200;
    rgba[i + 2] = 10;
    rgba[i + 3] = 255;

    const png = await sharp(rgba, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer();
    const white = await flattenOnWhite(png);
    const { data, info } = await sharp(white).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    const corner = cornerPixel(data, { width: info.width!, height: info.height!, channels: 3 }, 0, 0);
    expect(corner).toEqual({ r: 255, g: 255, b: 255 });
    const subject = cornerPixel(data, { width: info.width!, height: info.height!, channels: 3 }, 1, 1);
    expect(subject.g).toBeGreaterThan(subject.r);
  });
});

describe('applyWhiteBackground', () => {
  it('skips rembg when ID_PHOTO_WHITE_BG=0', async () => {
    const prev = process.env.ID_PHOTO_WHITE_BG;
    process.env.ID_PHOTO_WHITE_BG = '0';
    try {
      const src = await rgbJpeg(600, 600, { r: 200, g: 24, b: 24 });
      const { buffer, applied } = await applyWhiteBackground(src);
      expect(applied).toBe(false);
      expect(buffer).toBe(src);
    } finally {
      if (prev === undefined) delete process.env.ID_PHOTO_WHITE_BG;
      else process.env.ID_PHOTO_WHITE_BG = prev;
    }
  });

  it('fail-opens when rembg throws', async () => {
    const src = await rgbJpeg(600, 600, { r: 200, g: 24, b: 24 });
    const { buffer, applied } = await applyWhiteBackground(src, {
      removeBackground: async () => {
        throw new Error('onnx exploded');
      },
    });
    expect(applied).toBe(false);
    expect(buffer).toBe(src);
  });

  it('fail-opens when rembg exceeds the timeout', async () => {
    const src = await rgbJpeg(600, 600, { r: 200, g: 24, b: 24 });
    const { buffer, applied } = await applyWhiteBackground(src, {
      timeoutMs: 40,
      removeBackground: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(src), 400);
        }),
    });
    expect(applied).toBe(false);
    expect(buffer).toBe(src);
  });

  it('fail-opens when rembg returns a fully transparent cutout', async () => {
    const src = await rgbJpeg(600, 600, { r: 200, g: 24, b: 24 });
    const empty = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const { buffer, applied } = await applyWhiteBackground(src, {
      removeBackground: async () => empty,
    });
    expect(applied).toBe(false);
    expect(buffer).toBe(src);
  });

  it('fail-opens when rembg returns a soft ghost mask', async () => {
    const src = await rgbJpeg(80, 80, { r: 90, g: 70, b: 55 });
    const { buffer, applied } = await applyWhiteBackground(src, {
      removeBackground: async (input) => {
        const { data, info } = await sharp(input, { failOn: 'none' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        for (let i = 3; i < data.length; i += 4) {
          data[i] = 40;
        }
        return sharp(data, {
          raw: { width: info.width!, height: info.height!, channels: 4 },
        })
          .png()
          .toBuffer();
      },
    });
    expect(applied).toBe(false);
    expect(buffer).toBe(src);
  });

  it('composites the cut-out subject onto white', async () => {
    const src = await subjectOnRed(640);
    const { buffer, applied } = await applyWhiteBackground(src, {
      removeBackground: colorKeyRedBackground,
    });
    expect(applied).toBe(true);

    const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width!;
    const h = info.height!;
    const ch = info.channels ?? 3;
    expectNearWhite(cornerPixel(data, { width: w, height: h, channels: ch }, 8, 8));
    expectNearWhite(cornerPixel(data, { width: w, height: h, channels: ch }, w - 8, 8));
    expectNearWhite(cornerPixel(data, { width: w, height: h, channels: ch }, 8, h - 8));
    expectNearWhite(cornerPixel(data, { width: w, height: h, channels: ch }, w - 8, h - 8));

    const mid = cornerPixel(data, { width: w, height: h, channels: ch }, Math.floor(w / 2), Math.floor(h / 2));
    expect(mid.r).toBeLessThan(80);
  });
});

describe('prepareStoredIdPhoto', () => {
  it('writes 600×600 JPEG with white corners after mocked rembg', async () => {
    const src = await subjectOnRed(800);
    const out = await prepareStoredIdPhoto(src, { removeBackground: colorKeyRedBackground });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(ID_PHOTO_OUTPUT_SIZE);
    expect(meta.height).toBe(ID_PHOTO_OUTPUT_SIZE);
    expect(meta.hasAlpha).toBeFalsy();

    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels ?? 3;
    expectNearWhite(cornerPixel(data, { width: 600, height: 600, channels: ch }, 4, 4));
    expectNearWhite(cornerPixel(data, { width: 600, height: 600, channels: ch }, 595, 4));
    expectNearWhite(cornerPixel(data, { width: 600, height: 600, channels: ch }, 4, 595));
    expectNearWhite(cornerPixel(data, { width: 600, height: 600, channels: ch }, 595, 595));
  });

  it('still normalizes to 600×600 JPEG when rembg fails', async () => {
    const src = await rgbJpeg(900, 600, { r: 32, g: 96, b: 176 });
    const out = await prepareStoredIdPhoto(src, {
      removeBackground: async () => {
        throw new Error('timeout');
      },
    });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(600);

    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = cornerPixel(data, { width: info.width!, height: info.height!, channels: info.channels ?? 3 }, 10, 10);
    expect(px.b).toBeGreaterThan(px.r);
  });

  it('still rejects photos that are too small', async () => {
    const src = await rgbJpeg(400, 500, { r: 32, g: 96, b: 176 });
    await expect(
      prepareStoredIdPhoto(src, { removeBackground: colorKeyRedBackground }),
    ).rejects.toThrow(ID_PHOTO_TOO_SMALL_MESSAGE);
  });
});

describe('isRembgU2netpModel', () => {
  it('pins the rembg u2netp SHA-256', () => {
    expect(REMBG_U2NETP_SHA256).toBe(
      '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    );
  });

  it('rejects a same-sized buffer that is not the rembg weights', () => {
    expect(isRembgU2netpModel(Buffer.alloc(1_500_000, 7))).toBe(false);
  });

  it('rejects an undersized buffer', () => {
    expect(isRembgU2netpModel(Buffer.from('not-a-model'))).toBe(false);
  });
});
