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

/**
 * Check HEIC/HEIF via magic bytes (most reliable), MIME type, and extension.
 * Magic bytes: offset 4 has 'ftyp', offset 8 has brand (heic, heix, hevc, hevx, etc.)
 */
async function checkHeicMagicBytes(file: File): Promise<boolean> {
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    if (bytes.length < 12) return false;
    
    // Check for 'ftyp' box at offset 4
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp !== 'ftyp') return false;
    
    // Check brand at offset 8
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];
    
    return heicBrands.includes(brand);
  } catch {
    return false;
  }
}

/** Detect if file is HEIC/HEIF based on magic bytes, MIME type, or extension */
async function isHeicFile(file: File): Promise<boolean> {
  // Check magic bytes first (most reliable)
  const hasMagicBytes = await checkHeicMagicBytes(file);
  if (hasMagicBytes) return true;
  
  // Check MIME type
  const mimeType = file.type.toLowerCase();
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return true;
  }
  
  // Check file extension as final fallback
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    return true;
  }
  
  return false;
}

/**
 * Detect progressive JPEG by scanning for SOF2 (FF C2) marker.
 * Progressive JPEGs are known to cause issues in iOS Safari with canvas operations.
 */
async function isProgressiveJpeg(file: Blob): Promise<boolean> {
  try {
    // Read first 64KB to scan for markers
    const slice = file.slice(0, 65536);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Check for JPEG SOI (FF D8)
    if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      return false;
    }
    
    // Scan for SOF2 (Start Of Frame - Progressive DCT: FF C2)
    for (let i = 2; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xC2) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Re-encode JPEG (especially progressive) to baseline JPEG.
 * This fixes Safari canvas issues with progressive JPEGs.
 */
async function reencodeToBaselineJpeg(blob: Blob): Promise<Blob> {
  try {
    // Try createImageBitmap first (more reliable for progressive JPEGs)
    if (typeof createImageBitmap !== 'undefined') {
      const imageBitmap = await createImageBitmap(blob);
      
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');
      
      ctx.drawImage(imageBitmap, 0, 0);
      imageBitmap.close();
      
      // Export as baseline JPEG
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.95);
      });
    }
    
    // Fallback to Image element
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImage(objectUrl);
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');
      
      ctx.drawImage(img, 0, 0);
      
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.95);
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.error('JPEG re-encoding failed:', error);
    throw new Error('Could not re-encode JPEG');
  }
}

/** Convert HEIC/HEIF file to JPEG blob */
async function convertHeicToJpeg(file: File | Blob): Promise<Blob> {
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

/**
 * Check if canvas is blank/transparent (common issue with progressive JPEGs in Safari)
 */
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Check first 100 pixels - if all transparent or all same color, likely blank
  let nonZeroCount = 0;
  for (let i = 0; i < Math.min(400, data.length); i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a > 0 && (r > 0 || g > 0 || b > 0)) {
      nonZeroCount++;
    }
  }
  
  // If less than 10% of sampled pixels have color, consider blank
  return nonZeroCount < 10;
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

  // Check if canvas is blank (progressive JPEG issue in Safari)
  if (isCanvasBlank(canvas)) {
    throw new Error('Canvas is blank - image may not be fully decoded');
  }

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
  const originalFileRef = useRef<File | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      // Cleanup object URL on unmount
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [stopCamera]);

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
      // Image load failed, but don't block the user - they can still try to process
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
    originalFileRef.current = null; // Camera photos don't need re-encoding
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
    
    // Store original file for potential retry
    originalFileRef.current = file;
    
    // Check if it's an image file
    const isImage = file.type.startsWith('image/');
    const isPotentialHeic = await isHeicFile(file);
    
    if (!isImage && !isPotentialHeic) {
      toast.error('Invalid file type', {
        description: 'Please choose a photo file.',
        duration: 5000,
      });
      return;
    }
    
    let blobToUse: Blob = file;
    let needsHeicConversion = isPotentialHeic;
    
    // Convert HEIC/HEIF to JPEG before creating object URL
    if (needsHeicConversion) {
      const convertToastId = toast.loading('Converting photo...', {
        description: 'Processing HEIC image format',
      });
      
      try {
        blobToUse = await convertHeicToJpeg(file);
        toast.success('Photo converted', { id: convertToastId, duration: 2000 });
      } catch (error) {
        console.error('HEIC conversion error:', error);
        toast.error('Conversion failed', {
          id: convertToastId,
          description: 'Could not convert HEIC image. Trying alternate method...',
          duration: 4000,
        });
        // Don't return - try to load the original file anyway (Safari 17+ can display HEIC)
        blobToUse = file;
      }
    }
    
    // Check if it's a progressive JPEG and re-encode to baseline if needed
    // Progressive JPEGs cause canvas issues in iOS Safari
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg' || 
                   file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
    
    if (isJpeg && !needsHeicConversion) {
      const isProgressive = await isProgressiveJpeg(blobToUse);
      if (isProgressive) {
        const reencodeToastId = toast.loading('Processing photo...', {
          description: 'Optimizing progressive JPEG for compatibility',
        });
        
        try {
          blobToUse = await reencodeToBaselineJpeg(blobToUse);
          toast.success('Photo optimized', { id: reencodeToastId, duration: 2000 });
        } catch (error) {
          console.error('JPEG re-encoding failed:', error);
          // Continue with original - will retry if load fails
          toast.dismiss(reencodeToastId);
        }
      }
    }
    
    // Revoke previous object URL if any
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    
    // Create object URL (preferred over FileReader data URL)
    const objectUrl = URL.createObjectURL(blobToUse);
    objectUrlRef.current = objectUrl;
    
    // Test if the image loads
    const testImg = new Image();
    testImg.onload = () => {
      // Success - use this URL
      setImageSrc(objectUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setImageSize(null);
      setMode('crop');
    };
    testImg.onerror = async () => {
      // Image load failed - try appropriate recovery based on file type
      if (needsHeicConversion) {
        // Already tried HEIC conversion, give up
        toast.error('Image load failed', {
          description: 'Could not load this HEIC image. Please try taking a new photo or use a different file.',
          duration: 6000,
        });
        URL.revokeObjectURL(objectUrl);
        objectUrlRef.current = null;
      } else if (isJpeg) {
        // Try re-encoding JPEG to baseline
        const fallbackToastId = toast.loading('Retrying with image optimization...', {
          description: 'First attempt failed, trying alternate encoding',
        });
        
        try {
          const reencodedBlob = await reencodeToBaselineJpeg(file);
          URL.revokeObjectURL(objectUrl);
          const newObjectUrl = URL.createObjectURL(reencodedBlob);
          objectUrlRef.current = newObjectUrl;
          
          toast.success('Photo loaded', { id: fallbackToastId, duration: 2000 });
          
          setImageSrc(newObjectUrl);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setCroppedAreaPixels(null);
          setImageSize(null);
          setMode('crop');
        } catch (reencodeError) {
          console.error('Fallback JPEG re-encoding failed:', reencodeError);
          toast.error('Image load failed', {
            id: fallbackToastId,
            description: 'Could not load this image. Please try taking a new photo or use a different file.',
            duration: 6000,
          });
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
      } else {
        // Non-JPEG, non-HEIC image failed - could try HEIC conversion as last resort
        const fallbackToastId = toast.loading('Retrying with format conversion...', {
          description: 'First attempt failed, trying alternate method',
        });
        
        try {
          const convertedBlob = await convertHeicToJpeg(file);
          URL.revokeObjectURL(objectUrl);
          const newObjectUrl = URL.createObjectURL(convertedBlob);
          objectUrlRef.current = newObjectUrl;
          
          toast.success('Photo loaded', { id: fallbackToastId, duration: 2000 });
          
          setImageSrc(newObjectUrl);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setCroppedAreaPixels(null);
          setImageSize(null);
          setMode('crop');
        } catch (conversionError) {
          console.error('Fallback conversion failed:', conversionError);
          toast.error('Image load failed', {
            id: fallbackToastId,
            description: 'Could not load this image. Please try taking a new photo or use a different file.',
            duration: 6000,
          });
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
      }
    };
    testImg.src = objectUrl;
  };

  const reset = () => {
    stopCamera();
    setMode('select');
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setImageSize(null);
    originalFileRef.current = null;
    
    // Revoke object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
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
      
      let dataUrl: string;
      try {
        dataUrl = await processCrop(imageSrc, cropArea);
      } catch (cropError: any) {
        // If canvas is blank (progressive JPEG issue), retry with re-encoded image
        if (cropError.message?.includes('blank') && originalFileRef.current) {
          const retryToastId = toast.loading('Retrying with optimized image...', {
            description: 'Canvas issue detected, re-encoding image',
          });
          
          try {
            // Re-encode the original file to baseline JPEG
            const reencodedBlob = await reencodeToBaselineJpeg(originalFileRef.current);
            
            // Create new object URL
            if (objectUrlRef.current) {
              URL.revokeObjectURL(objectUrlRef.current);
            }
            const newObjectUrl = URL.createObjectURL(reencodedBlob);
            objectUrlRef.current = newObjectUrl;
            
            // Update the cropper's image source
            setImageSrc(newObjectUrl);
            
            // Wait a bit for the new image to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Retry processing with the new image
            dataUrl = await processCrop(newObjectUrl, cropArea);
            toast.success('Photo processed', { id: retryToastId, duration: 2000 });
          } catch (retryError) {
            console.error('Retry with re-encoding failed:', retryError);
            toast.error('Processing failed', {
              id: retryToastId,
              description: 'Could not process this image. Please try taking a new photo.',
              duration: 6000,
            });
            throw retryError;
          }
        } else {
          throw cropError;
        }
      }
      
      setProcessedPreview(dataUrl);
      onPhotoProcessed(dataUrl);
      setMode('select');
      setImageSrc(null);
      
      // Revoke object URL after successful processing
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
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
        <div className="relative w-full bg-gray-100 rounded-xl overflow-hidden" style={{ maxHeight: '45vh', minHeight: '240px', height: '240px' }}>
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
