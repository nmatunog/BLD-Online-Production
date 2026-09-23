import sharp from 'sharp';
import {
  hasHorizontalScanlineArtifact,
  imageHasScanlineArtifact,
} from './id-photo-integrity';

describe('hasHorizontalScanlineArtifact', () => {
  it('flags dense even/odd row banding', () => {
    const size = 64;
    const rgb = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y++) {
      const v = y % 2 === 0 ? 255 : 40;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 3;
        rgb[i] = rgb[i + 1] = rgb[i + 2] = v;
      }
    }
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(true);
  });

  it('does not flag a smooth vertical gradient', () => {
    const size = 64;
    const rgb = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y++) {
      const v = Math.round((y / (size - 1)) * 255);
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 3;
        rgb[i] = rgb[i + 1] = rgb[i + 2] = v;
      }
    }
    expect(hasHorizontalScanlineArtifact(rgb, size, size, 3)).toBe(false);
  });
});

describe('imageHasScanlineArtifact', () => {
  it('detects a scanlined JPEG', async () => {
    const size = 80;
    const rgb = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y++) {
      const v = y % 2 === 0 ? 250 : 30;
      rgb.fill(v, y * size * 3, (y + 1) * size * 3);
    }
    const jpeg = await sharp(rgb, { raw: { width: size, height: size, channels: 3 } })
      .jpeg({ quality: 95, progressive: false })
      .toBuffer();
    await expect(imageHasScanlineArtifact(jpeg)).resolves.toBe(true);
  });
});
