import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { normalizeIdPhoto } from './id-photo-normalize';

const logger = new Logger('IdPhotoWhiteBg');

/** Fail-open timeout for rembg + white composite (brief: 10–15s). */
export const ID_PHOTO_WHITE_BG_TIMEOUT_MS = 12_000;

/** Pure white canvas behind the cut-out subject. */
export const ID_PHOTO_WHITE_BG = { r: 255, g: 255, b: 255 };

/** rembg u2netp input size. */
const U2NETP_SIZE = 320;

const U2NETP_MEAN = [0.485, 0.456, 0.406];
const U2NETP_STD = [0.229, 0.224, 0.225];

/**
 * ~4.6MB quantized U-2-Net-p (same weights rembg uses). Cached under os.tmpdir().
 * Override with ID_PHOTO_REMBG_MODEL_URL or ID_PHOTO_REMBG_MODEL_PATH.
 */
const DEFAULT_MODEL_URLS = [
  'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
  'https://huggingface.co/andrey18106/u2netp/resolve/main/u2netp.onnx',
];

const MODEL_MIN_BYTES = 1_000_000;
const MODEL_MAX_BYTES = 12_000_000;

/**
 * Returns a PNG (or other sharp-readable buffer) with an alpha channel:
 * subject opaque, background transparent.
 */
export type RemoveBackgroundFn = (input: Buffer) => Promise<Buffer>;

export type ApplyWhiteBgOptions = {
  removeBackground?: RemoveBackgroundFn;
  timeoutMs?: number;
};

export type WhiteBgResult = {
  buffer: Buffer;
  applied: boolean;
};

let sessionPromise: Promise<unknown> | null = null;

export function isIdPhotoWhiteBgEnabled(): boolean {
  const raw = (process.env.ID_PHOTO_WHITE_BG ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

function timeoutMsFromEnv(fallback: number): number {
  const raw = process.env.ID_PHOTO_WHITE_BG_TIMEOUT_MS;
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function modelCachePath(): string {
  return process.env.ID_PHOTO_REMBG_MODEL_PATH?.trim() || path.join(os.tmpdir(), 'bld-id-photo-u2netp.onnx');
}

async function downloadModel(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'BLD-Online-Production/id-photo-p2b' },
  });
  if (!res.ok) {
    throw new Error(`Model download HTTP ${res.status} from ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MODEL_MIN_BYTES || buf.length > MODEL_MAX_BYTES) {
    throw new Error(`Unexpected model size ${buf.length} from ${url}`);
  }
  const tmp = `${dest}.${process.pid}.tmp`;
  await fs.promises.writeFile(tmp, buf);
  await fs.promises.rename(tmp, dest);
}

async function ensureModelFile(): Promise<string> {
  const dest = modelCachePath();
  try {
    const st = await fs.promises.stat(dest);
    if (st.isFile() && st.size >= MODEL_MIN_BYTES && st.size <= MODEL_MAX_BYTES) {
      return dest;
    }
  } catch {
    // missing
  }

  const urls = [
    process.env.ID_PHOTO_REMBG_MODEL_URL?.trim(),
    ...DEFAULT_MODEL_URLS,
  ].filter((u): u is string => Boolean(u));

  let lastError: unknown;
  for (const url of urls) {
    try {
      await downloadModel(url, dest);
      logger.log(`Cached rembg u2netp model (${(await fs.promises.stat(dest)).size} bytes) at ${dest}`);
      return dest;
    } catch (err) {
      lastError = err;
      logger.warn(`Could not download rembg model from ${url}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not download rembg model');
}

type OrtModule = typeof import('onnxruntime-node');
type OrtSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

async function loadOrt(): Promise<OrtModule> {
  return import('onnxruntime-node');
}

async function getSession(): Promise<OrtSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await loadOrt();
      const modelPath = await ensureModelFile();
      return ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        intraOpNumThreads: 1,
        interOpNumThreads: 1,
      });
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise as Promise<OrtSession>;
}

function rgbToNchwFloat32(rgb: Buffer, width: number, height: number): Float32Array {
  const hw = width * height;
  const out = new Float32Array(3 * hw);
  let max = 1;
  for (let i = 0; i < rgb.length; i++) {
    if (rgb[i] > max) max = rgb[i];
  }
  for (let i = 0; i < hw; i++) {
    const r = rgb[i * 3] / max;
    const g = rgb[i * 3 + 1] / max;
    const b = rgb[i * 3 + 2] / max;
    out[i] = (r - U2NETP_MEAN[0]) / U2NETP_STD[0];
    out[hw + i] = (g - U2NETP_MEAN[1]) / U2NETP_STD[1];
    out[2 * hw + i] = (b - U2NETP_MEAN[2]) / U2NETP_STD[2];
  }
  return out;
}

function minMaxToUint8(pred: Float32Array): Buffer {
  let min = pred[0];
  let max = pred[0];
  for (let i = 1; i < pred.length; i++) {
    const v = pred[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const out = Buffer.alloc(pred.length);
  for (let i = 0; i < pred.length; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(((pred[i] - min) / range) * 255)));
  }
  return out;
}

async function opaquePixelRatio(cutout: Buffer): Promise<number> {
  const { data, info } = await sharp(cutout, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = (info.width ?? 0) * (info.height ?? 0);
  if (!pixels) return 0;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 16) opaque++;
  }
  return opaque / pixels;
}

/**
 * Default OSS rembg: onnxruntime-node + rembg u2netp.
 *
 * Not @imgly/background-removal-node: AGPL + sharp ~0.32.4 native conflict with P1 sharp ^0.34.5.
 */
export async function u2netpRemoveBackground(input: Buffer): Promise<Buffer> {
  const ort = await loadOrt();
  const session = await getSession();

  const oriented = sharp(input, { failOn: 'none' }).rotate();
  const { data: rgb, info } = await oriented
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (!width || !height) {
    throw new Error('Could not read photo for rembg');
  }

  const modelRgb = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .resize(U2NETP_SIZE, U2NETP_SIZE, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();

  const tensor = new ort.Tensor('float32', rgbToNchwFloat32(modelRgb, U2NETP_SIZE, U2NETP_SIZE), [
    1,
    3,
    U2NETP_SIZE,
    U2NETP_SIZE,
  ]);
  const inputName = session.inputNames[0];
  const results = await session.run({ [inputName]: tensor });
  const output = results[session.outputNames[0]];
  if (!output) {
    throw new Error('rembg model returned no output');
  }
  const predRaw = output.data as Float32Array;
  const plane = U2NETP_SIZE * U2NETP_SIZE;
  if (predRaw.length < plane) {
    throw new Error(`rembg mask too small (${predRaw.length})`);
  }
  const pred = predRaw.length === plane ? predRaw : predRaw.subarray(0, plane);
  const mask320 = minMaxToUint8(pred);

  const mask = await sharp(mask320, {
    raw: { width: U2NETP_SIZE, height: U2NETP_SIZE, channels: 1 },
  })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();

  const { data: rgba } = await oriented
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < width * height; i++) {
    rgba[i * 4 + 3] = mask[i];
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

export async function flattenOnWhite(cutout: Buffer): Promise<Buffer> {
  return sharp(cutout, { failOn: 'none' })
    .ensureAlpha()
    .flatten({ background: ID_PHOTO_WHITE_BG })
    .png()
    .toBuffer();
}

/**
 * Attempt white-BG cleanup. Never throws: on disable, rembg error, empty cutout,
 * or timeout, returns the original buffer.
 */
export async function applyWhiteBackground(
  input: Buffer,
  options?: ApplyWhiteBgOptions,
): Promise<WhiteBgResult> {
  const remover = options?.removeBackground ?? (isIdPhotoWhiteBgEnabled() ? u2netpRemoveBackground : null);
  if (!remover) {
    return { buffer: input, applied: false };
  }

  const timeoutMs = options?.timeoutMs ?? timeoutMsFromEnv(ID_PHOTO_WHITE_BG_TIMEOUT_MS);

  try {
    const cutout = await withTimeout(
      remover(input),
      timeoutMs,
      `ID photo rembg timed out after ${timeoutMs}ms`,
    );

    const opaque = await opaquePixelRatio(cutout);
    if (opaque < 0.01) {
      logger.warn('ID photo white-BG cleanup skipped: rembg produced an empty subject');
      return { buffer: input, applied: false };
    }

    const flattened = await flattenOnWhite(cutout);
    return { buffer: flattened, applied: true };
  } catch (err) {
    logger.warn(
      `ID photo white-BG cleanup skipped, keeping crop: ${err instanceof Error ? err.message : err}`,
    );
    return { buffer: input, applied: false };
  }
}

/** Load ONNX session (and model file) in the background so the first upload is less likely to time out. */
export async function warmupIdPhotoWhiteBg(): Promise<void> {
  if (!isIdPhotoWhiteBgEnabled()) return;
  try {
    await withTimeout(getSession(), 60_000, 'ID photo rembg warmup timed out after 60000ms');
    logger.log('ID photo rembg session ready');
  } catch (err) {
    logger.warn(`ID photo rembg warmup failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * White-BG cleanup (fail-open) then P1 normalize: 1:1 cover crop, 600×600 JPEG ~q82.
 */
export async function prepareStoredIdPhoto(
  input: Buffer,
  options?: ApplyWhiteBgOptions,
): Promise<Buffer> {
  const { buffer } = await applyWhiteBackground(input, options);
  return normalizeIdPhoto(buffer);
}
