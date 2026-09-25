import sharp from 'sharp';
import {
  hasHorizontalScanlineArtifact,
  imageHasScanlineArtifact,
} from './id-photo-integrity';

function fillRow(rgb: Buffer, width: number, y: number, value: number): void {
  rgb.fill(value, y * width * 3, (y + 1) * width * 3);
}

function solidRgb(width: number, height: number, value: number): Buffer {
  const rgb = Buffer.alloc(width * height * 3);
  rgb.fill(value);
  return rgb;
}

function periodBanding(width: number, height: number, pattern: number[]): Buffer {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    fillRow(rgb, width, y, pattern[y % pattern.length]);
  }
  return rgb;
}

/** Horizontal slats like window blinds — period much longer than 2–4 px. */
function blindsRgb(width: number, height: number, slat = 20): Buffer {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    const v = Math.floor(y / slat) % 2 === 0 ? 230 : 40;
    fillRow(rgb, width, y, v);
  }
  return rgb;
}

/**
 * Portrait-like frame: plain walls, a face blob, and a horizontally striped
 * shirt in the lower-middle third only.
 */
function clothingStripesRgb(size = 96): Buffer {
  const rgb = solidRgb(size, size, 236);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const dx = x - size / 2;
      const dy = y - size * 0.32;
      if (dx * dx + dy * dy < (size * 0.16) ** 2) {
        rgb[i] = 210;
        rgb[i + 1] = 160;
        rgb[i + 2] = 130;
        continue;
      }
      const inShirt = x > size * 0.28 && x < size * 0.72 && y > size * 0.48 && y < size * 0.92;
      if (inShirt) {
        const v = Math.floor((y - size * 0.48) / 8) % 2 === 0 ? 30 : 90;
        rgb[i] = v;
        rgb[i + 1] = v + 10;
        rgb[i + 2] = v + 40;
      }
    }
  }
  return rgb;
}

describe('hasHorizontalScanlineArtifact', () => {
  it('flags dense even/odd row banding', () => {
    const size = 64;
    const rgb = periodBanding(size, size, [255, 40]);
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(true);
  });

  it('flags synthetic 3-row rembg banding (255,255,224,254,254,220,…)', () => {
    const size = 96;
    const rgb = Buffer.alloc(size * size * 3);
    const pattern = [255, 255, 224, 254, 254, 220];
    for (let y = 0; y < size; y++) {
      fillRow(rgb, size, y, pattern[y % pattern.length]);
    }
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(true);
  });

  it('flags 4-row processing banding', () => {
    const size = 80;
    const rgb = periodBanding(size, size, [250, 250, 40, 40]);
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(true);
  });

  it('does not flag a smooth vertical gradient', () => {
    const size = 64;
    const rgb = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y++) {
      fillRow(rgb, size, y, Math.round((y / (size - 1)) * 255));
    }
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(false);
  });

  it('does not flag naturally striped window blinds', () => {
    const size = 96;
    const rgb = blindsRgb(size, size, 20);
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(false);
  });

  it('does not flag a shirt with horizontal stripes on a plain wall', () => {
    const size = 96;
    const rgb = clothingStripesRgb(size);
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(false);
  });
});

describe('imageHasScanlineArtifact', () => {
  it('detects a scanlined JPEG', async () => {
    const size = 80;
    const rgb = periodBanding(size, size, [250, 30]);
    const jpeg = await sharp(rgb, { raw: { width: size, height: size, channels: 3 } })
      .jpeg({ quality: 95, progressive: false })
      .toBuffer();
    await expect(imageHasScanlineArtifact(jpeg)).resolves.toBe(true);
  });

  it('detects a 3-row banding PNG', async () => {
    const size = 96;
    const rgb = periodBanding(size, size, [255, 255, 224]);
    const png = await sharp(rgb, { raw: { width: size, height: size, channels: 3 } })
      .png()
      .toBuffer();
    await expect(imageHasScanlineArtifact(png)).resolves.toBe(true);
  });
});
