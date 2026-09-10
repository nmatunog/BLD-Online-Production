/**
 * QRScannerCard - Prominent QR scanner with continuous mode default ON
 * Used in staff check-in flows
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, QrCode, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';

export interface QRScannerCardProps {
  onScanSuccess: (decodedText: string) => Promise<void>;
  disabled?: boolean;
  qrCodeRegionId?: string;
  className?: string;
}

export function QRScannerCard({
  onScanSuccess,
  disabled = false,
  qrCodeRegionId = 'qr-scanner-card',
  className = ''
}: QRScannerCardProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true); // Default ON
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ deviceId: string; label: string }>>([]);
  const scannerRef = useRef<QRScanner | null>(null);

  useEffect(() => {
    checkCameraAvailability();
  }, []);

  const checkCameraAvailability = async () => {
    try {
      const available = await QRScanner.isCameraAvailable();
      setCameraAvailable(available);
      if (available) {
        const cameras = await QRScanner.getAvailableCameras();
        setAvailableCameras(cameras);
      }
    } catch (error) {
      console.error('Camera check failed:', error);
      setCameraAvailable(false);
    }
  };

  const startScanner = async () => {
    if (!cameraAvailable) {
      toast.error('Camera not available', {
        description: 'Please enable camera permissions',
      });
      return;
    }

    setIsScanning(true);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const element = document.getElementById(qrCodeRegionId);
    if (!element) {
      setIsScanning(false);
      toast.error('Scanner element not found');
      return;
    }

    try {
      scannerRef.current = new QRScanner(
        qrCodeRegionId,
        handleQRScanSuccess,
        handleQRScanError,
        {
          continuousMode,
          fps: 20,
          facingMode: 'environment',
          showTorchButtonIfSupported: true,
        }
      );
      await scannerRef.current.start();
    } catch (error) {
      console.error('Failed to start scanner:', error);
      setIsScanning(false);
      toast.error('Failed to start camera');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchEnabled(false);
  };

  const handleQRScanSuccess = async (decodedText: string) => {
    try {
      await onScanSuccess(decodedText);
    } catch (error) {
      console.error('Scan success handler error:', error);
    }
  };

  const handleQRScanError = (errorMessage: string) => {
    if (
      !errorMessage.includes('No barcode or QR code detected') &&
      !errorMessage.includes('No MultiFormat Readers')
    ) {
      console.error('QR scan error:', errorMessage);
    }
  };

  return (
    <Card className={`bg-white border-purple-200 shadow-sm ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <QrCode className="w-5 h-5 text-purple-600" />
          QR Code Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScanning ? (
          <>
            <Button
              onClick={startScanner}
              disabled={!cameraAvailable || disabled}
              className="w-full min-h-[56px] text-lg font-semibold bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Scanner
            </Button>
            {!cameraAvailable && (
              <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertCircle className="w-5 h-5 mx-auto mb-2 text-yellow-600" />
                <p className="text-sm font-medium text-yellow-900">Camera not available</p>
                <p className="text-xs text-yellow-700 mt-1">Please enable camera access</p>
              </div>
            )}
            <p className="text-sm text-gray-500 text-center">
              Point camera at member QR code to check in
            </p>
          </>
        ) : (
          <>
            <div className="relative bg-black rounded-lg overflow-hidden border-2 border-purple-300">
              <div 
                id={qrCodeRegionId} 
                className="w-full" 
                style={{ aspectRatio: '1/1', minHeight: '300px' }}
              />
              <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-semibold px-2 py-1 rounded">
                Scanning...
              </div>
            </div>

            {/* Scanner Controls */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {/* Torch Button */}
              <Button
                type="button"
                variant="outline"
                className="bg-gray-700 hover:bg-gray-800 text-white border-gray-700"
                onClick={async () => {
                  if (scannerRef.current) {
                    const toggled = await scannerRef.current.toggleTorch();
                    setTorchEnabled(toggled);
                  }
                }}
                title="Toggle flashlight"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {torchEnabled ? 'ON' : 'OFF'}
              </Button>

              {/* Camera Switch */}
              {availableCameras.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-800 text-white border-gray-700"
                  onClick={async () => {
                    if (scannerRef.current) {
                      await scannerRef.current.switchCamera();
                    }
                  }}
                  title="Switch camera"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Switch
                </Button>
              )}

              {/* Continuous Mode Toggle */}
              <Button
                type="button"
                variant="outline"
                className={continuousMode ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300'}
                onClick={() => {
                  setContinuousMode(!continuousMode);
                  toast.info(continuousMode ? 'Single scan mode' : 'Continuous mode');
                }}
                title={continuousMode ? 'Continuous mode ON' : 'Single scan mode'}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {continuousMode ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  )}
                </svg>
                {continuousMode ? 'Continuous' : 'Single'}
              </Button>
            </div>

            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700 font-medium">Ready to scan</p>
              <p className="text-xs text-purple-600 mt-1">Point camera at QR code</p>
            </div>

            <Button
              onClick={stopScanner}
              variant="outline"
              className="w-full border-2 border-purple-400 text-purple-700 hover:bg-purple-50"
            >
              <X className="w-4 h-4 mr-2" />
              Stop Scanner
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
