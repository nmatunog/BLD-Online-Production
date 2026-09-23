import sharp from 'sharp';

/**
 * Dense horizontal scanlines (even/odd row oscillation) after a bad raw/JPEG
 * encode. Smooth portraits have similar adjacent-row and skip-1 row energy;
 * scanlines make adjacent rows differ far more than every-other-row.
 */
export function hasHorizontalScanlineArtifact(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): boolean {
  if (width < 16 || height < 16 || channels < 3) return false;

  const rowMeans = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const row = y * width * channels;
    for (let x = 0; x < width; x++) {
      const i = row + x * channels;
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    rowMeans[y] = sum / width;
  }

  let adj = 0;
  let skip = 0;
  for (let y = 1; y < height; y++) {
    adj += Math.abs(rowMeans[y] - rowMeans[y - 1]);
    if (y >= 2) skip += Math.abs(rowMeans[y] - rowMeans[y - 2]);
  }
  const adjMean = adj / (height - 1);
  const skipMean = skip / Math.max(1, height - 2);

  return adjMean > 6 && adjMean > skipMean * 1.75;
}

export async function imageHasScanlineArtifact(input: Buffer): Promise<boolean> {
  const { data, info } = await sharp(input, { failOn: 'truncated' })
    .removeAlpha()
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true });
  return hasHorizontalScanlineArtifact(
    data,
    info.width ?? 0,
    info.height ?? 0,
    info.channels ?? 0,
  );
}

export const ID_PHOTO_DAMAGED_MESSAGE =
  'Photo processing produced a damaged image. Please try another photo.';
