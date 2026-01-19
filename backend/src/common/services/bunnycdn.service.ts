import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class BunnyCDNService {
  private readonly logger = new Logger(BunnyCDNService.name);
  private readonly storageZone: string;
  private readonly accessKey: string;
  private readonly cdnUrl: string;
  private readonly storageUrl: string;

  constructor(private configService: ConfigService) {
    this.storageZone = this.configService.get<string>('BUNNYCDN_STORAGE_ZONE') || '';
    this.accessKey = this.configService.get<string>('BUNNYCDN_ACCESS_KEY') || '';
    this.cdnUrl = this.configService.get<string>('BUNNYCDN_CDN_URL') || '';
    this.storageUrl = `https://storage.bunnycdn.com/${this.storageZone}`;
  }

  /**
   * Upload a file (as buffer or base64 data URL) to BunnyCDN
   * @param fileData - Buffer or base64 data URL string
   * @param fileName - Name of the file (e.g., 'qr-codes/member-123.png')
   * @param contentType - MIME type (e.g., 'image/png')
   * @returns URL of the uploaded file
   */
  async uploadFile(
    fileData: Buffer | string,
    fileName: string,
    contentType: string = 'image/png',
  ): Promise<string> {
    try {
      // Convert base64 data URL to buffer if needed
      let buffer: Buffer;
      if (typeof fileData === 'string') {
        // Handle data URL format: data:image/png;base64,iVBORw0KGgo...
        const base64Data = fileData.includes(',')
          ? fileData.split(',')[1]
          : fileData;
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = fileData;
      }

      const url = `${this.storageUrl}/${fileName}`;
      const urlObj = new URL(url);
      
      // Use Node.js https module for upload
      const response = await new Promise<{ statusCode: number; statusMessage: string; data: string }>((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname,
          method: 'PUT',
          headers: {
            'AccessKey': this.accessKey,
            'Content-Type': contentType,
            'Content-Length': buffer.length,
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 500,
              statusMessage: res.statusMessage || 'Unknown',
              data,
            });
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.write(buffer);
        req.end();
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(
          `BunnyCDN upload failed: ${response.statusCode} ${response.statusMessage} - ${response.data}`,
        );
      }

      // Return CDN URL if configured, otherwise storage URL
      const fileUrl = this.cdnUrl
        ? `${this.cdnUrl}/${fileName}`
        : `${this.storageUrl}/${fileName}`;

      this.logger.log(`File uploaded successfully: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file to BunnyCDN: ${error}`);
      throw error;
    }
  }

  /**
   * Upload QR code image to BunnyCDN
   * @param qrCodeDataUrl - Base64 data URL of the QR code
   * @param type - Type of QR code ('member' or 'event')
   * @param id - ID of the member or event
   * @returns URL of the uploaded QR code
   */
  async uploadQRCode(
    qrCodeDataUrl: string,
    type: 'member' | 'event',
    id: string,
  ): Promise<string> {
    const fileName = `qr-codes/${type}/${id}-${Date.now()}.png`;
    return this.uploadFile(qrCodeDataUrl, fileName, 'image/png');
  }

  /**
   * Delete a file from BunnyCDN
   * @param fileName - Name of the file to delete
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      const url = `${this.storageUrl}/${fileName}`;
      const urlObj = new URL(url);
      
      // Use Node.js https module for delete
      const response = await new Promise<{ statusCode: number; statusMessage: string; data: string }>((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname,
          method: 'DELETE',
          headers: {
            'AccessKey': this.accessKey,
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 500,
              statusMessage: res.statusMessage || 'Unknown',
              data,
            });
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.end();
      });

      if (response.statusCode !== 200 && response.statusCode !== 404) {
        throw new Error(
          `BunnyCDN delete failed: ${response.statusCode} ${response.statusMessage} - ${response.data}`,
        );
      }

      this.logger.log(`File deleted successfully: ${fileName}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from BunnyCDN: ${error}`);
      throw error;
    }
  }

  /**
   * Check if BunnyCDN is configured
   */
  isConfigured(): boolean {
    return !!(
      this.storageZone &&
      this.accessKey &&
      (this.cdnUrl || this.storageUrl)
    );
  }
}

