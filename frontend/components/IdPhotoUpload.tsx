'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Camera, Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Mode = 'select' | 'camera' | 'crop';

interface IdPhotoUploadProps {
  onPhotoProcessed: (photoDataUrl: string | null) => void;
  currentPhoto?: string | null;
  accentColor?: string;
  required?: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = src;
  });
}

/** Check if file is HEIC/HEIF via magic bytes, MIME, or extension */
async function isHeicFile(file: File): Promise<boolean> {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  
  // Check MIME type
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return true;
  }
  
  // Check file extension
  if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    return true;
  }
  
  // Check magic bytes: read first 16 bytes to detect ftyp brands
  try {
    const header = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(header);
    
    // HEIC/HEIF files have 'ftyp' at offset 4
    if (bytes.length >= 12 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      // Check brand at offset 8 (4 bytes)
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'heif'];
      if (heicBrands.includes(brand)) {
        return true;
      }
    }
  } catch (err) {
    // If we can't read bytes, fall back to MIME/extension check above
    console.warn('Could not read file magic bytes:', err);
  }
  
  return false;
}

/** Convert HEIC/HEIF file to JPEG blob */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  try {
    // Dynamic import to avoid server-side 'window is not defined' error
    const heic2any = (await import('heic2any')).default;
    
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    
    // heic2any can return Blob or Blob[] - handle both cases
    if (Array.isArray(result)) {
      return result[0];
    }
    return result;
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error('Could not convert HEIC image');
  }
}

/** Crop to 1:1, 300×300 JPEG, mild lighting boost. */
async function processCrop(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await loadImage(imageSrc);
  const size = 300;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const brightness = 1.12;
  const contrast = 1.08;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * contrast + 128) * brightness));
    data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * contrast + 128) * brightness));
    data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * contrast + 128) * brightness));
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export function IdPhotoUpload({
  onPhotoProcessed,
  currentPhoto = null,
  accentColor = '#D00008',
  required = false,
}: IdPhotoUploadProps) {
  const [mode, setMode] = useState<Mode>('select');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setProcessedPreview] = useState<string | null>(currentPhoto);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      revokeObjectUrl();
    };
  }, [stopCamera, revokeObjectUrl]);

  useEffect(() => {
    setProcessedPreview(currentPhoto);
  }, [currentPhoto]);

  // Load image to get dimensions
  useEffect(() => {
    if (!imageSrc) {
      setImageSize(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      setImageSize(null);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
      streamRef.current = stream;
      setMode('camera');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      alert('Unable to access camera. Please allow camera permission or upload a file instead.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopCamera();
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setImageSize(null);
    setMode('crop');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    
    // Check if it's an image file
    const mightBeHeic = await isHeicFile(file);
    const isImage = file.type.startsWith('image/') || mightBeHeic;
    if (!isImage) {
      toast.error('Invalid file type', {
        description: 'Please choose a photo file.',
        duration: 5000,
      });
      return;
    }
    
    let fileToUse = file;
    
    // Convert HEIC/HEIF to JPEG before cropping
    if (mightBeHeic) {
      const convertToastId = toast.loading('Converting photo...', {
        description: 'Processing HEIC image format',
      });
      
      try {
        const jpegBlob = await convertHeicToJpeg(file);
        fileToUse = new File([jpegBlob], file.name.replace(/\.heic$/i, '.jpg'), {
          type: 'image/jpeg',
        });
        toast.success('Photo converted', { id: convertToastId, duration: 2000 });
      } catch (error) {
        console.error('HEIC conversion error:', error);
        toast.dismiss(convertToastId);
        
        // Fallback: try loading as-is (Safari 17+ can display HEIC)
        toast.info('Trying native display...', { duration: 2000 });
      }
    }
    
    // Use createObjectURL for better performance and compatibility
    revokeObjectUrl();
    const objectUrl = URL.createObjectURL(fileToUse);
    objectUrlRef.current = objectUrl;
    
    // Test if we can load this image
    const testImg = new Image();
    testImg.onload = () => {
      setImageSrc(objectUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setImageSize(null);
      setMode('crop');
    };
    testImg.onerror = async () => {
      // Image failed to load - try HEIC conversion if we haven't already
      if (!mightBeHeic) {
        // Maybe it was HEIC but we missed it - try conversion
        try {
          const jpegBlob = await convertHeicToJpeg(file);
          const retryUrl = URL.createObjectURL(jpegBlob);
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = retryUrl;
          setImageSrc(retryUrl);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setCroppedAreaPixels(null);
          setImageSize(null);
          setMode('crop');
          toast.success('Photo format detected and converted');
        } catch {
          toast.error('Could not load image', {
            description: 'This photo format is not supported. Please try taking a new photo or use JPEG/PNG.',
            duration: 6000,
          });
          revokeObjectUrl();
        }
      } else {
        toast.error('Could not load image', {
          description: 'The photo could not be displayed. Please try taking a new photo.',
          duration: 6000,
        });
        revokeObjectUrl();
      }
    };
    testImg.src = objectUrl;
  };

  const reset = () => {
    stopCamera();
    revokeObjectUrl();
    setMode('select');
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setImageSize(null);
  };

  const applyCrop = async () => {
    if (!imageSrc) return;
    
    setIsProcessing(true);
    try {
      let cropArea = croppedAreaPixels;
      
      // If onCropComplete never fired (iOS Safari issue), calculate a sensible default:
      // centered 1:1 crop
      if (!cropArea && imageSize) {
        const minDimension = Math.min(imageSize.width, imageSize.height);
        const x = (imageSize.width - minDimension) / 2;
        const y = (imageSize.height - minDimension) / 2;
        cropArea = {
          x,
          y,
          width: minDimension,
          height: minDimension,
        };
        toast.info('Using centered crop', {
          description: 'Crop area auto-detected. Photo will be centered and cropped to square.',
          duration: 4000,
        });
      } else if (!cropArea) {
        // Fallback: load image dimensions now if imageSize is not available
        const image = await loadImage(imageSrc);
        const minDimension = Math.min(image.width, image.height);
        const x = (image.width - minDimension) / 2;
        const y = (image.height - minDimension) / 2;
        cropArea = {
          x,
          y,
          width: minDimension,
          height: minDimension,
        };
        toast.info('Using centered crop', {
          description: 'Crop area auto-detected. Photo will be centered and cropped to square.',
          duration: 4000,
        });
      }
      
      const dataUrl = await processCrop(imageSrc, cropArea);
      setProcessedPreview(dataUrl);
      onPhotoProcessed(dataUrl);
      setMode('select');
      setImageSrc(null);
    } catch (err) {
      console.error('Photo processing failed:', err);
      toast.error('Photo processing failed', { 
        description: 'Could not process the photo. Please try another photo.', 
        duration: 6000 
      });
      reset();
    } finally {
      setIsProcessing(false);
    }
  };

  const clearPhoto = () => {
    setProcessedPreview(null);
    onPhotoProcessed(null);
  };

  if (mode === 'camera') {
    return (
      <div className="space-y-4">
        <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
        <p className="text-sm text-gray-600 text-center">
          Face the camera against a plain light or white wall. Use even lighting.
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 h-12" onClick={reset}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 h-12 text-white"
            style={{ backgroundColor: accentColor }}
            onClick={capturePhoto}
          >
            <Camera className="w-4 h-4" />
            Capture
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'crop' && imageSrc) {
    return (
      <div className="space-y-4">
        <div className="relative w-full bg-gray-100 rounded-xl overflow-hidden" style={{ height: 'min(45vh, 240px)' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, area) => setCroppedAreaPixels(area)}
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Zoom</Label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full mt-1"
          />
        </div>
        <p className="text-sm text-gray-600 text-center">
          Frame your face, then tap Process. Photo will be cropped and brightened for your ID card.
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 h-12" onClick={reset} disabled={isProcessing}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 h-12 text-white"
            style={{ backgroundColor: accentColor }}
            onClick={applyCrop}
            disabled={isProcessing}
          >
            {isProcessing ? (
              'Processing…'
            ) : (
              <>
                <Check className="w-4 h-4" />
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
        {required ? (
          <span className="text-[#D00008]">*</span>
        ) : (
          <span className="text-gray-500 font-normal text-base">(optional)</span>
        )}
      </Label>

      {preview && (
        <div className="relative w-32 h-32 mx-auto">
          {/* Processed JPEG data URL or CDN URL */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="ID photo preview"
            className="w-full h-full object-cover rounded-xl border-2"
            style={{ borderColor: accentColor }}
          />
          <button
            type="button"
            onClick={clearPhoto}
            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            aria-label={required ? 'Retake photo' : 'Remove photo'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <p className="text-sm text-gray-600">
        {required
          ? 'A face photo is required for the ID database and your Community ID card. Use a plain light or white wall background with even lighting.'
          : 'Take or upload a face photo against a plain light or white wall for your Community ID.'}
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
          <span className="text-sm font-semibold">Take photo</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-24 flex-col gap-2"
          style={{ borderColor: `${accentColor}40` }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8" style={{ color: accentColor }} />
          <span className="text-sm font-semibold">Upload photo</span>
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,image/heic,image/heif"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
