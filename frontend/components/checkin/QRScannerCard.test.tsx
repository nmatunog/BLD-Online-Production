import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QRScannerCard } from './QRScannerCard';

const { mockIsCameraAvailable } = vi.hoisted(() => ({
  mockIsCameraAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/qr-scanner-service', () => ({
  QRScanner: {
    isCameraAvailable: mockIsCameraAvailable,
    getAvailableCameras: vi.fn().mockResolvedValue([]),
  },
}));

describe('QRScannerCard camera cleanup', () => {
  beforeEach(() => {
    mockIsCameraAvailable.mockResolvedValue(true);
  });

  it('stops the scanner on unmount after it was started', async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const start = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(
      <QRScannerCard
        onScanSuccess={async () => undefined}
        qrCodeRegionId="qr-test-unmount"
        createScanner={() => ({ start, stop })}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan QR' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    await waitFor(() => expect(start).toHaveBeenCalled());

    unmount();
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });

  it('stops the scanner when the tab is hidden', async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const start = vi.fn().mockResolvedValue(undefined);
    render(
      <QRScannerCard
        onScanSuccess={async () => undefined}
        qrCodeRegionId="qr-test-hidden"
        createScanner={() => ({ start, stop })}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan QR' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    await waitFor(() => expect(start).toHaveBeenCalled());

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(stop).toHaveBeenCalled());
  });
});
