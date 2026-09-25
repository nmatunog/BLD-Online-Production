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
import { QRScanner } from '@/lib/qr-scanner-service';

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
        <CardTitle className="text-[1.375rem] flex items-center gap-2 text-gray-900">
          <QrCode className="w-6 h-6 text-rose-800" />
          Scan QR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScanning ? (
          <>
            <Button
              onClick={startScanner}
              disabled={!cameraAvailable || disabled}
              className="w-full min-h-14 text-[1.25rem] font-semibold bg-rose-800 hover:bg-rose-900 text-white"
            >
              <Camera className="w-6 h-6 mr-2" />
              Scan QR
            </Button>
            {!cameraAvailable && (
              <div className="text-center p-3 bg-amber-50 rounded-lg border-2 border-amber-700">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-amber-800" />
                <p className="text-[1.125rem] font-semibold text-amber-950">Camera not available</p>
                <p className="text-[1.125rem] text-amber-950 mt-1">Please enable camera access</p>
              </div>
            )}
            <p className="text-[1.125rem] font-medium text-gray-800 text-center">
              Point the camera at a member QR code
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
              <div className="absolute top-2 right-2 bg-rose-800 text-white text-[1rem] font-semibold px-2 py-1 rounded">
                Scanning…
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full text-[1.125rem] font-semibold bg-gray-800 hover:bg-gray-900 text-white border-gray-800"
                onClick={async () => {
                  if (scannerRef.current) {
                    const toggled = await scannerRef.current.toggleTorch();
                    setTorchEnabled(toggled);
                  }
                }}
              >
                Flashlight {torchEnabled ? 'ON' : 'OFF'}
              </Button>

              {availableCameras.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 w-full text-[1.125rem] font-semibold bg-gray-800 hover:bg-gray-900 text-white border-gray-800"
                  onClick={async () => {
                    if (scannerRef.current) {
                      await scannerRef.current.switchCamera();
                    }
                  }}
                >
                  Switch camera
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                className={continuousMode
                  ? 'min-h-12 w-full text-[1.125rem] font-semibold bg-green-700 hover:bg-green-800 text-white border-green-700'
                  : 'min-h-12 w-full text-[1.125rem] font-semibold bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-400'}
                onClick={() => {
                  setContinuousMode(!continuousMode);
                  toast.info(continuousMode ? 'Single scan mode' : 'Continuous mode');
                }}
              >
                {continuousMode ? 'Continuous scan ON' : 'Single scan'}
              </Button>
            </div>

            <div className="text-center p-3 bg-rose-50 rounded-lg border-2 border-rose-200">
              <p className="text-[1.125rem] text-rose-950 font-semibold">Ready to scan</p>
              <p className="text-[1.125rem] text-rose-950 mt-1">Point the camera at a QR code</p>
            </div>

            <Button
              onClick={stopScanner}
              variant="outline"
              className="w-full min-h-12 border-2 border-gray-500 text-[1.125rem] font-semibold text-gray-900 hover:bg-gray-50"
            >
              <X className="w-5 h-5 mr-2" />
              Stop scanner
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
