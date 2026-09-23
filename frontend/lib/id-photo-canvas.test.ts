import { describe, expect, it, vi } from 'vitest';
import {
  getCanvas2dContext,
  installCanvasWillReadFrequently,
  merge2dContextOptions,
} from './id-photo-canvas';

describe('merge2dContextOptions', () => {
  it('sets willReadFrequently and keeps other 2d options', () => {
    expect(merge2dContextOptions({ alpha: false })).toEqual({
      alpha: false,
      willReadFrequently: true,
    });
  });

  it('overrides a false willReadFrequently flag', () => {
    expect(merge2dContextOptions({ willReadFrequently: false })).toEqual({
      willReadFrequently: true,
    });
  });
});

describe('getCanvas2dContext', () => {
  it('requests a 2d context with willReadFrequently for getImageData readbacks', () => {
    const getContext = vi.fn().mockReturnValue({});
    const canvas = { getContext } as unknown as HTMLCanvasElement;

    getCanvas2dContext(canvas);

    expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
  });
});

describe('installCanvasWillReadFrequently', () => {
  it('returns an uninstall function even when HTMLCanvasElement is missing', () => {
    expect(typeof installCanvasWillReadFrequently()).toBe('function');
  });
});
