import { describe, expect, it, vi } from 'vitest';
import { stopQrScannerSafely } from './stop-qr-scanner';

describe('stopQrScannerSafely', () => {
  it('calls scanner.stop and ignores a second failure', async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    await stopQrScannerSafely({ stop });
    expect(stop).toHaveBeenCalledTimes(1);

    const failing = vi.fn().mockRejectedValue(new Error('already stopped'));
    await expect(stopQrScannerSafely({ stop: failing })).resolves.toBeUndefined();
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('stops leftover MediaStream tracks on video elements', async () => {
    const trackStop = vi.fn();
    const video = {
      srcObject: {
        getTracks: () => [{ stop: trackStop }],
      },
    } as unknown as HTMLVideoElement;
    const container = {
      querySelectorAll: () => [video],
    } as unknown as ParentNode;

    await stopQrScannerSafely(null, container);
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });

  it('no-ops when scanner and container are missing', async () => {
    await expect(stopQrScannerSafely(null, null)).resolves.toBeUndefined();
  });
});
