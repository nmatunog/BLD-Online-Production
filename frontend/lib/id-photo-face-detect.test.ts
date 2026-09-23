import { describe, expect, it, vi } from 'vitest';
import { isWebGLAvailable, resolveTfBackendName } from './id-photo-face-detect';

describe('resolveTfBackendName', () => {
  it('uses cpu when WebGL is unavailable so TensorFlow never logs a WebGL error', () => {
    expect(resolveTfBackendName(false)).toBe('cpu');
  });

  it('uses webgl when the browser can create a context', () => {
    expect(resolveTfBackendName(true)).toBe('webgl');
  });
});

describe('isWebGLAvailable', () => {
  it('returns false when document is missing', () => {
    expect(isWebGLAvailable(undefined)).toBe(false);
  });

  it('returns false when every WebGL context probe is null', () => {
    const getContext = vi.fn().mockReturnValue(null);
    expect(isWebGLAvailable({ createElement: () => ({ getContext }) })).toBe(false);
    expect(getContext).toHaveBeenCalled();
  });

  it('returns true when a WebGL context is created', () => {
    const loseContext = vi.fn();
    const getContext = vi.fn().mockReturnValue({
      getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null),
    });
    expect(isWebGLAvailable({ createElement: () => ({ getContext }) })).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });
});
