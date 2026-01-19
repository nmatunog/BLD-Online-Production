// Enhanced QR Code Scanner Service - Migrated from BLD-Attendance-Monitor
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5Qrcode } from 'html5-qrcode';

export interface QRScannerOptions {
  fps?: number;
  qrbox?: { width: number; height: number };
  aspectRatio?: number;
  supportedScanTypes?: Html5QrcodeScanType[];
  facingMode?: 'environment' | 'user';
  continuousMode?: boolean;
  scanCooldown?: number;
  showTorchButtonIfSupported?: boolean;
  rememberLastUsedCamera?: boolean;
  disableFlip?: boolean;
}

export class QRScanner {
  private containerId: string;
  private onScanSuccess: (decodedText: string, decodedResult?: any) => void;
  private onScanError: (errorMessage: string) => void;
  private scanner: Html5QrcodeScanner | null = null;
  private html5Qrcode: Html5Qrcode | null = null;
  private currentCameraId: string | null = null;
  private isScanning: boolean = false;
  private options: Required<QRScannerOptions>;
  private lastScanTime: number = 0;
  private scanCount: number = 0;

  constructor(
    containerId: string,
    onScanSuccess: (decodedText: string, decodedResult?: any) => void,
    onScanError: (errorMessage: string) => void,
    options: QRScannerOptions = {}
  ) {
    this.containerId = containerId;
    this.onScanSuccess = onScanSuccess;
    this.onScanError = onScanError;

    // Set default options
    this.options = {
      fps: options.fps || 20, // Higher FPS for faster scanning
      qrbox: options.qrbox || this.calculateQRBoxSize(),
      aspectRatio: options.aspectRatio || 1.0,
      supportedScanTypes: options.supportedScanTypes || [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      facingMode: options.facingMode || 'environment',
      continuousMode: options.continuousMode !== false, // Default: true
      scanCooldown: options.scanCooldown || 1000, // Prevent duplicate scans
      showTorchButtonIfSupported: options.showTorchButtonIfSupported !== false,
      rememberLastUsedCamera: options.rememberLastUsedCamera !== false,
      disableFlip: options.disableFlip !== false,
    };
  }

  // Calculate responsive QR box size based on viewport
  private calculateQRBoxSize(): { width: number; height: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minDimension = Math.min(viewportWidth, viewportHeight);

    // Use 60-70% of the smaller viewport dimension
    const qrSize = Math.min(
      Math.max(minDimension * 0.65, 250), // Minimum 250px
      400 // Maximum 400px
    );

    return { width: qrSize, height: qrSize };
  }

  // Provide haptic feedback (vibration) if available
  private triggerHapticFeedback(): void {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(50); // Short vibration
      } catch (e) {
        // Ignore vibration errors
      }
    }
  }

  // Play success sound
  private playSuccessSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Higher pitch for success
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Fallback: audio feedback unavailable
      console.log('Audio feedback unavailable');
    }
  }

  // Check if error is a continuous scanning error (not a real error)
  private isContinuousScanError(errorMessage: string): boolean {
    const continuousErrors = [
      'No barcode or QR code detected',
      'No MultiFormat Readers were able to detect the code',
      'NotFoundException',
      'NotFoundException: No MultiFormat Readers',
    ];

    return continuousErrors.some((err) => errorMessage.includes(err));
  }

  // Handle successful scan with enhanced parsing
  private handleScanSuccess(decodedText: string, decodedResult?: any): void {
    // Prevent duplicate scans within cooldown period
    const now = Date.now();
    if (now - this.lastScanTime < this.options.scanCooldown) {
      return;
    }
    this.lastScanTime = now;
    this.scanCount++;

    // Provide feedback
    this.triggerHapticFeedback();
    this.playSuccessSound();

    // Call success callback
    if (this.onScanSuccess) {
      this.onScanSuccess(decodedText, decodedResult);
    }

    // Stop scanning if not in continuous mode
    if (!this.options.continuousMode) {
      setTimeout(() => this.stop(), 500);
    }
  }

  // Start QR code scanning
  async start(cameraId?: string | null): Promise<void> {
    if (this.isScanning) {
      console.warn('Scanner already running');
      return;
    }

    if (this.scanner || this.html5Qrcode) {
      await this.stop();
    }

    try {
      // Get available cameras
      const cameras = await QRScanner.getAvailableCameras();

      // Select camera
      let selectedCameraId = cameraId || this.currentCameraId;
      if (!selectedCameraId && cameras.length > 0) {
        // Prefer back camera (environment) for better QR scanning
        const backCamera = cameras.find(
          (cam) =>
            cam.label.toLowerCase().includes('back') ||
            cam.label.toLowerCase().includes('rear') ||
            cam.label.toLowerCase().includes('environment')
        );
        selectedCameraId = backCamera?.deviceId || cameras[0].deviceId;
      }

      // Use Html5Qrcode directly for more control
      this.html5Qrcode = new Html5Qrcode(this.containerId);

      const config = {
        fps: this.options.fps,
        qrbox: this.options.qrbox,
        aspectRatio: this.options.aspectRatio,
        disableFlip: this.options.disableFlip,
        videoConstraints: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: this.options.facingMode },
      };

      await this.html5Qrcode.start(
        selectedCameraId || { facingMode: this.options.facingMode },
        config,
        (decodedText, decodedResult) => {
          this.handleScanSuccess(decodedText, decodedResult);
        },
        (errorMessage) => {
          // Only report non-continuous scanning errors
          if (!this.isContinuousScanError(errorMessage)) {
            if (this.onScanError) {
              this.onScanError(errorMessage);
            }
          }
        }
      );

      this.currentCameraId = selectedCameraId || null;
      this.isScanning = true;
      this.scanCount = 0;
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      this.isScanning = false;

      // Fallback to scanner mode if direct mode fails
      try {
        this.scanner = new Html5QrcodeScanner(
          this.containerId,
          {
            fps: this.options.fps,
            qrbox: this.options.qrbox,
            aspectRatio: this.options.aspectRatio,
            supportedScanTypes: this.options.supportedScanTypes,
            showTorchButtonIfSupported: this.options.showTorchButtonIfSupported,
          },
          false // verbose
        );

        this.scanner.render(
          (decodedText, decodedResult) => {
            this.handleScanSuccess(decodedText, decodedResult);
          },
          (errorMessage) => {
            if (!this.isContinuousScanError(errorMessage)) {
              if (this.onScanError) {
                this.onScanError(errorMessage);
              }
            }
          }
        );
        this.isScanning = true;
      } catch (fallbackError) {
        console.error('Fallback scanner also failed:', fallbackError);
        this.isScanning = false;
        if (this.onScanError) {
          this.onScanError(`Failed to start camera: ${(fallbackError as Error).message}`);
        }
      }
    }
  }

  // Stop QR code scanning
  async stop(): Promise<void> {
    this.isScanning = false;

    try {
      if (this.html5Qrcode) {
        await this.html5Qrcode.stop();
        await this.html5Qrcode.clear();
        this.html5Qrcode = null;
      }

      if (this.scanner) {
        this.scanner.clear();
        this.scanner = null;
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
      // Force cleanup
      this.html5Qrcode = null;
      this.scanner = null;
    }

    this.currentCameraId = null;
  }

  // Switch camera (front/back)
  async switchCamera(): Promise<boolean> {
    if (!this.isScanning) return false;

    try {
      const cameras = await QRScanner.getAvailableCameras();
      if (cameras.length < 2) {
        throw new Error('Only one camera available');
      }

      // Find opposite camera
      const currentIsBack =
        this.currentCameraId &&
        cameras
          .find((c) => c.deviceId === this.currentCameraId)
          ?.label.toLowerCase()
          .includes('back');

      const targetCamera =
        cameras.find((cam) => {
          const isBack =
            cam.label.toLowerCase().includes('back') ||
            cam.label.toLowerCase().includes('rear') ||
            cam.label.toLowerCase().includes('environment');
          return currentIsBack ? !isBack : isBack;
        }) || cameras.find((c) => c.deviceId !== this.currentCameraId);

      if (targetCamera) {
        await this.stop();
        await this.start(targetCamera.deviceId);
        return true;
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
      if (this.onScanError) {
        this.onScanError(`Failed to switch camera: ${(error as Error).message}`);
      }
    }
    return false;
  }

  // Toggle torch/flashlight (if supported)
  async toggleTorch(): Promise<boolean> {
    if (!this.html5Qrcode || !this.isScanning) {
      return false;
    }

    try {
      // Check if torch is supported
      if (typeof (this.html5Qrcode as any).getState === 'function') {
        const state = await (this.html5Qrcode as any).getState();
        if (state && state.torchCapability === 'not-available') {
          return false;
        }
      }

      // Toggle torch if available
      if (typeof (this.html5Qrcode as any).toggleTorch === 'function') {
        await (this.html5Qrcode as any).toggleTorch();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to toggle torch:', error);
      return false;
    }
  }

  // Get scanner state
  getState() {
    return {
      isScanning: this.isScanning,
      currentCameraId: this.currentCameraId,
      scanCount: this.scanCount,
      hasScanner: !!this.scanner || !!this.html5Qrcode,
    };
  }

  // Check if camera is available
  static async isCameraAvailable(): Promise<boolean> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');
        return videoDevices.length > 0;
      }
      return false;
    } catch (error) {
      console.error('Camera check failed:', error);
      return false;
    }
  }

  // Get available cameras with labels
  static async getAvailableCameras(): Promise<Array<{ deviceId: string; label: string; kind: string }>> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        // First request permission to get labels
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e) {
          // Permission might be denied, but we can still enumerate
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices
          .filter((device) => device.kind === 'videoinput')
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.substring(0, 8)}`,
            kind: device.kind,
          }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get cameras:', error);
      return [];
    }
  }
}

// Utility functions for QR code parsing
export const qrUtils = {
  // Extract member data from QR scan
  extractMemberData(scannedData: any): { communityId: string; name?: string; email?: string } | null {
    // Try to parse as JSON first
    let parsedData: any = null;
    if (typeof scannedData === 'string') {
      try {
        parsedData = JSON.parse(scannedData);
      } catch {
        // Not JSON, continue with string handling
      }
    } else {
      parsedData = scannedData;
    }

    // Standard member QR code (JSON)
    if (parsedData && parsedData.type === 'member' && parsedData.communityId) {
      return {
        communityId: parsedData.communityId,
        name: parsedData.name,
        email: parsedData.email,
      };
    }

    // Legacy support - string community ID
    if (typeof scannedData === 'string') {
      const trimmed = scannedData.trim();
      // Check if it matches community ID format (CEB-ME1801)
      if (/^[A-Z]{3}-[A-Z]{2,3}\d{2,3}\d{2}$/.test(trimmed)) {
        return {
          communityId: trimmed,
          name: '',
          email: '',
        };
      }
    }

    // Legacy object format
    if (parsedData && parsedData.type === 'legacy' && parsedData.communityId) {
      return {
        communityId: parsedData.communityId,
        name: parsedData.name || '',
        email: parsedData.email || '',
      };
    }

    // Try to extract from raw data
    if (parsedData && (parsedData.raw || parsedData.data)) {
      const rawData = parsedData.raw || parsedData.data;
      if (typeof rawData === 'string' && rawData.trim().length > 0) {
        return {
          communityId: rawData.trim(),
          name: '',
          email: '',
        };
      }
    }

    return null;
  },
};






