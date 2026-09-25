import sharp from 'sharp';

const MIN_PERIOD = 2;
const MAX_PERIOD = 4;
const DETREND_RADIUS = 5;
const MIN_RESIDUAL_STD = 4;
const MIN_AUTOCORR = 0.48;
const MIN_PERIOD_SEPARATION = 0.1;
const MIN_ZERO_CROSSING_RATE = 0.3;
const MIN_UNIFORM_THIRDS = 2;

function luma(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function rowMeans(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x0: number,
  x1: number,
): Float64Array {
  const means = new Float64Array(height);
  const cols = Math.max(1, x1 - x0);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const row = y * width * channels;
    for (let x = x0; x < x1; x++) {
      const i = row + x * channels;
      sum += luma(data[i], data[i + 1], data[i + 2]);
    }
    means[y] = sum / cols;
  }
  return means;
}

function detrend(values: Float64Array, radius = DETREND_RADIUS): Float64Array {
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let n = 0;
    const from = Math.max(0, i - radius);
    const to = Math.min(values.length - 1, i + radius);
    for (let j = from; j <= to; j++) {
      sum += values[j];
      n++;
    }
    out[i] = values[i] - sum / n;
  }
  return out;
}

function mean(values: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return values.length ? sum / values.length : 0;
}

function residualStd(values: Float64Array): number {
  const m = mean(values);
  let ss = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - m;
    ss += d * d;
  }
  return values.length ? Math.sqrt(ss / values.length) : 0;
}

function autocorrelation(values: Float64Array, lag: number): number {
  const n = values.length - lag;
  if (n < 8 || lag < 1) return 0;
  const m = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - m;
    den += d * d;
  }
  if (den < 1e-6) return 0;
  for (let i = 0; i < n; i++) {
    num += (values[i] - m) * (values[i + lag] - m);
  }
  return num / den;
}

function zeroCrossingRate(values: Float64Array): number {
  if (values.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === 0 || values[i - 1] === 0) continue;
    if (values[i] * values[i - 1] < 0) crossings++;
  }
  return crossings / (values.length - 1);
}

function periodAbsDiff(values: Float64Array, period: number): number {
  let sum = 0;
  let n = 0;
  for (let i = period; i < values.length; i++) {
    sum += Math.abs(values[i] - values[i - period]);
    n++;
  }
  return n ? sum / n : Number.POSITIVE_INFINITY;
}

function bestFinePeriod(residual: Float64Array): { period: number; ac: number } {
  let period = 0;
  let ac = Number.NEGATIVE_INFINITY;
  for (let p = MIN_PERIOD; p <= MAX_PERIOD; p++) {
    const value = autocorrelation(residual, p);
    if (value > ac) {
      ac = value;
      period = p;
    }
  }
  return { period, ac };
}

function hasClassicPeriod2(rowLuma: Float64Array): boolean {
  if (rowLuma.length < 16) return false;
  let adj = 0;
  let skip = 0;
  for (let y = 1; y < rowLuma.length; y++) {
    adj += Math.abs(rowLuma[y] - rowLuma[y - 1]);
    if (y >= 2) skip += Math.abs(rowLuma[y] - rowLuma[y - 2]);
  }
  const adjMean = adj / (rowLuma.length - 1);
  const skipMean = skip / Math.max(1, rowLuma.length - 2);
  return adjMean > 6 && adjMean > skipMean * 1.75;
}

function thirdsShowPeriod(thirds: Float64Array[], period: number): number {
  let count = 0;
  for (const third of thirds) {
    const residual = detrend(third);
    if (residualStd(residual) < 3) continue;
    if (autocorrelation(residual, period) >= 0.4) count++;
  }
  return count;
}

/**
 * Dense horizontal scanlines after a bad rembg/raw encode.
 * Uses row-mean autocorrelation at periods 2–4 (the 3-channel-as-alpha
 * bug produced a 3-row period: 255,255,224,254,254,220,…).
 *
 * Natural stripes (clothing, blinds) are rejected when they are localized
 * or have a much longer period than 2–4 px.
 */
export function hasHorizontalScanlineArtifact(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): boolean {
  if (width < 16 || height < 24 || channels < 3) return false;

  const leftEnd = Math.floor(width / 3);
  const midEnd = Math.floor((2 * width) / 3);
  const full = rowMeans(data, width, height, channels, 0, width);
  const thirds = [
    rowMeans(data, width, height, channels, 0, leftEnd),
    rowMeans(data, width, height, channels, leftEnd, midEnd),
    rowMeans(data, width, height, channels, midEnd, width),
  ];

  const residual = detrend(full);
  const energy = residualStd(residual);
  const zcr = zeroCrossingRate(residual);
  const { period, ac } = bestFinePeriod(residual);
  const neighborLag = period === 3 ? 2 : period === 2 ? 3 : 3;
  const neighborAc = autocorrelation(residual, neighborLag);
  const periodDiff = periodAbsDiff(full, period || 2);
  const otherDiff = periodAbsDiff(full, neighborLag);
  const uniform = thirdsShowPeriod(thirds, period || 2) >= MIN_UNIFORM_THIRDS;

  const periodicFineBanding =
    energy >= MIN_RESIDUAL_STD &&
    zcr >= MIN_ZERO_CROSSING_RATE &&
    period >= MIN_PERIOD &&
    period <= MAX_PERIOD &&
    ac >= MIN_AUTOCORR &&
    ac >= neighborAc + MIN_PERIOD_SEPARATION &&
    periodDiff * 1.25 < otherDiff &&
    uniform;

  const classicPeriod2 = hasClassicPeriod2(full) && thirdsShowPeriod(thirds, 2) >= MIN_UNIFORM_THIRDS;

  return periodicFineBanding || classicPeriod2;
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
