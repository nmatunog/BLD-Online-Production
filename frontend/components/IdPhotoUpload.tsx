'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Upload, X, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Cropper, { Area } from 'react-easy-crop';
import { removeBackground } from '@imgly/background-removal';

interface IdPhotoUploadProps {
  onPhotoProcessed: (photoDataUrl: string) => void;
  currentPhoto?: string | null;
  accentColor?: string;
}

export function IdPhotoUpload({
  onPhotoProcessed,
  currentPhoto,
  accentColor = '#D00008',
}: IdPhotoUploadProps) {
  const [mode, setMode] = useState<'select' | 'camera' | 'upload' | 'crop'>('select');
  const [imageSource, setImageSource] = useState<string | null>(currentPhoto || null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(currentPhoto || null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('camera');
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Unable to access camera. Please check permissions or use file upload.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setImageSource(dataUrl);
      stopCamera();
      setMode('crop');
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImageSource(dataUrl);
      setMode('crop');
    };
    reader.readAsDataURL(file);
  }, []);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    const targetSize = 300;
    canvas.width = targetSize;
    canvas.height = targetSize;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      targetSize,
      targetSize
    );

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const optimizeLighting = (imageData: ImageData): ImageData => {
    const data = imageData.data;
    const brightness = 1.2;
    const contrast = 1.1;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, ((data[i] - 128) * contrast + 128) * brightness);
      data[i + 1] = Math.min(255, ((data[i + 1] - 128) * contrast + 128) * brightness);
      data[i + 2] = Math.min(255, ((data[i + 2] - 128) * contrast + 128) * brightness);
    }

    return imageData;
  };

  const processImage = async () => {
    if (!imageSource || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(imageSource, croppedAreaPixels);
      
      const img = await createImage(croppedImage);
      const blob = await removeBackground(croppedImage);
      const url = URL.createObjectURL(blob);
      
      const processedImg = await createImage(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('No 2d context');

      canvas.width = 300;
      canvas.height = 300;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 300, 300);
      
      ctx.drawImage(processedImg, 0, 0, 300, 300);
      
      const imageData = ctx.getImageData(0, 0, 300, 300);
      const optimizedData = optimizeLighting(imageData);
      ctx.putImageData(optimizedData, 0, 0);

      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      setProcessedImage(finalDataUrl);
      onPhotoProcessed(finalDataUrl);
      setMode('select');
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Image processing error:', error);
      alert('Error processing image. Please try another photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = useCallback(() => {
    stopCamera();
    setMode('select');
    setImageSource(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [stopCamera]);

  if (mode === 'camera') {
    return (
      <div className="space-y-4">
        <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 border-4 border-white/30 rounded-xl pointer-events-none" />
        </div>
        
        <p className="text-sm text-gray-600 text-center">
          Position your face in the center with good lighting
        </p>
        
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={reset}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            style={{ backgroundColor: accentColor }}
            onClick={capturePhoto}
          >
            <Camera className="w-4 h-4 mr-2" />
            Capture
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'crop' && imageSource) {
    return (
      <div className="space-y-4">
        <div className="relative w-full aspect-square bg-gray-100 rounded-xl overflow-hidden">
          <Cropper
            image={imageSource}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Zoom</Label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>
        
        <p className="text-sm text-gray-600 text-center">
          Adjust the crop to frame your face, then process to add white background and optimize lighting
        </p>
        
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={reset}
            disabled={isProcessing}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            style={{ backgroundColor: accentColor }}
            onClick={processImage}
            disabled={isProcessing}
          >
            {isProcessing ? (
              'Processing...'
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Process
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="text-lg md:text-xl font-semibold text-gray-900">
        ID Photo{' '}
        <span className="text-gray-500 font-normal text-base">(optional)</span>
      </Label>
      
      {processedImage && (
        <div className="relative w-32 h-32 mx-auto">
          <img
            src={processedImage}
            alt="ID Photo"
            className="w-full h-full object-cover rounded-xl border-2"
            style={{ borderColor: accentColor }}
          />
          <button
            type="button"
            onClick={() => setProcessedImage(null)}
            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <p className="text-sm text-gray-600">
        Upload or take a photo for your ID. We'll automatically add a white background and optimize lighting.
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-24 flex-col gap-2"
          style={{ borderColor: `${accentColor}40` }}
          onClick={startCamera}
        >
          <Camera className="w-8 h-8" style={{ color: accentColor }} />
          <span className="text-sm font-semibold">Take Photo</span>
        </Button>
        
        <Button
          type="button"
          variant="outline"
          className="h-24 flex-col gap-2"
          style={{ borderColor: `${accentColor}40` }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8" style={{ color: accentColor }} />
          <span className="text-sm font-semibold">Upload Photo</span>
        </Button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
