/**
 * 2D context for ID-photo pipelines that call getImageData / putImageData.
 * Chrome warns when multiple readbacks omit willReadFrequently.
 */
export function getCanvas2dContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true });
}
