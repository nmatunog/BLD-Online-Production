import { describe, expect, it, vi } from 'vitest';
import { getCanvas2dContext } from './id-photo-canvas';

describe('getCanvas2dContext', () => {
  it('requests a 2d context with willReadFrequently for getImageData readbacks', () => {
    const getContext = vi.fn().mockReturnValue({});
    const canvas = { getContext } as unknown as HTMLCanvasElement;

    getCanvas2dContext(canvas);

    expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
  });
});
