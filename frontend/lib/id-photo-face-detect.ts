'use client';

import {
  FACE_SCORE_THRESHOLD,
  pickPrimaryFace,
  type FaceBox,
} from '@/lib/id-photo-face-crop';

const MODEL_URL = '/models/blazeface/model.json';
const DETECT_TIMEOUT_MS = 4000;

type BlazeFaceModel = {
  estimateFaces: (
    input: HTMLImageElement,
    returnTensors?: boolean,
  ) => Promise<
    Array<{
      topLeft: [number, number] | number[];
      bottomRight: [number, number] | number[];
      probability?: number[] | number;
    }>
  >;
};

let modelPromise: Promise<BlazeFaceModel> | null = null;

type WebGLProbeDocument = {
  createElement: (tagName: 'canvas') => {
    getContext: (contextId: string) => unknown;
  };
};

/** Probe the browser before TensorFlow tries WebGL (TF logs a hard error on failure). */
export function isWebGLAvailable(
  doc: WebGLProbeDocument | undefined = typeof document !== 'undefined'
    ? (document as unknown as WebGLProbeDocument)
    : undefined,
): boolean {
  if (!doc) return false;
  try {
    const canvas = doc.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl || typeof (gl as WebGLRenderingContext).getExtension !== 'function') {
      return false;
    }
    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function resolveTfBackendName(webglAvailable: boolean = isWebGLAvailable()): 'webgl' | 'cpu' {
  return webglAvailable ? 'webgl' : 'cpu';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Face detection timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function loadBlazeFace(): Promise<BlazeFaceModel> {
  if (typeof window === 'undefined') {
    throw new Error('Face detection is browser-only');
  }

  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      const blazeface = await import('@tensorflow-models/blazeface');

      try {
        const backend = resolveTfBackendName();
        const ok = await tf.setBackend(backend);
        if (!ok && backend === 'webgl') {
          await tf.setBackend('cpu');
        }
      } catch {
        await tf.setBackend('cpu');
      }
      try {
        await tf.ready();
      } catch {
        await tf.setBackend('cpu');
        await tf.ready();
      }

      return blazeface.load({
        modelUrl: MODEL_URL,
        scoreThreshold: FACE_SCORE_THRESHOLD,
        maxFaces: 10,
      }) as Promise<BlazeFaceModel>;
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }

  return modelPromise;
}

function predictionToFaceBox(pred: {
  topLeft: [number, number] | number[];
  bottomRight: [number, number] | number[];
  probability?: number[] | number;
}): FaceBox | null {
  const x1 = Number(pred.topLeft[0]);
  const y1 = Number(pred.topLeft[1]);
  const x2 = Number(pred.bottomRight[0]);
  const y2 = Number(pred.bottomRight[1]);
  if (![x1, y1, x2, y2].every((n) => Number.isFinite(n))) return null;

  const rawScore = pred.probability;
  const score = typeof rawScore === 'number' ? rawScore : Number(rawScore?.[0] ?? 0);
  const width = x2 - x1;
  const height = y2 - y1;
  if (width < 2 || height < 2) return null;

  return { x: x1, y: y1, width, height, score };
}

/**
 * Detect the primary face in a decoded image. Returns null on no-face, low
 * confidence, timeout, or any load/inference error (caller falls back to P1).
 */
export async function detectPrimaryFace(image: HTMLImageElement): Promise<FaceBox | null> {
  if (typeof window === 'undefined') return null;
  if (!image?.width || !image?.height) return null;

  try {
    const model = await withTimeout(loadBlazeFace(), DETECT_TIMEOUT_MS);
    const predictions = await withTimeout(model.estimateFaces(image, false), DETECT_TIMEOUT_MS);
    const faces = predictions
      .map(predictionToFaceBox)
      .filter((face): face is FaceBox => face !== null);
    return pickPrimaryFace(faces);
  } catch {
    return null;
  }
}
