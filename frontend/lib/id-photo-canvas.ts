type PatchedGetContext = typeof HTMLCanvasElement.prototype.getContext & {
  __bldWillReadFrequently?: boolean;
};

export function merge2dContextOptions(
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2DSettings {
  return { ...options, willReadFrequently: true };
}

/**
 * 2D context for ID-photo pipelines that call getImageData / putImageData.
 * Chrome warns when multiple readbacks omit willReadFrequently.
 */
export function getCanvas2dContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', merge2dContextOptions());
}

/**
 * TensorFlow / heic2any call getContext('2d') without willReadFrequently.
 * Once a canvas has a 2d context, later option bags are ignored — so patch
 * the prototype for the photo-editor lifetime.
 */
export function installCanvasWillReadFrequently(): () => void {
  if (typeof HTMLCanvasElement === 'undefined') return () => undefined;

  const proto = HTMLCanvasElement.prototype;
  const original = proto.getContext as PatchedGetContext;
  if (original.__bldWillReadFrequently) {
    return () => undefined;
  }

  const patched = function (
    this: HTMLCanvasElement,
    contextId: string,
    options?: unknown,
  ) {
    if (contextId === '2d') {
      return (original as (...args: unknown[]) => unknown).call(
        this,
        contextId,
        merge2dContextOptions(options as CanvasRenderingContext2DSettings | undefined),
      );
    }
    return (original as (...args: unknown[]) => unknown).call(this, contextId, options);
  } as PatchedGetContext;
  patched.__bldWillReadFrequently = true;
  proto.getContext = patched;

  return () => {
    proto.getContext = original;
  };
}
