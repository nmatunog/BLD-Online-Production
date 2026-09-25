export type StoppableScanner = {
  stop: () => Promise<unknown> | unknown;
};

function stopMediaTracks(container?: ParentNode | null): void {
  if (!container || typeof container.querySelectorAll !== 'function') return;
  container.querySelectorAll('video').forEach((node) => {
    const video = node as HTMLVideoElement;
    const media = video.srcObject;
    if (media && typeof (media as MediaStream).getTracks === 'function') {
      (media as MediaStream).getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // already stopped
        }
      });
    }
    video.srcObject = null;
  });
}

/**
 * Stop a QR scanner instance and any leftover camera tracks.
 * Safe to call twice (unmount + Hide scanner / visibilitychange).
 */
export async function stopQrScannerSafely(
  scanner: StoppableScanner | null | undefined,
  container?: ParentNode | null,
): Promise<void> {
  if (scanner) {
    try {
      await scanner.stop();
    } catch {
      // html5-qrcode throws if already stopped
    }
  }
  stopMediaTracks(container);
}
