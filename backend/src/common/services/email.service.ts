import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;
  private readonly isConfigured: boolean;

  constructor(private configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@bldcebu.org';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.isConfigured = !!this.resendApiKey;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName?: string,
  ): Promise<{ sent: boolean; resetLink?: string }> {
    const resetLink = `${this.frontendUrl}/reset-password?token=${resetToken}`;
    
    if (!this.isConfigured) {
      this.logger.warn('Resend API key not configured, skipping email send');
      // In development, log the reset link instead
      this.logger.log(`Password reset link for ${email}: ${resetLink}`);
      return { sent: false, resetLink };
    }

    try {
      const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
      
      const emailData = JSON.stringify({
        from: this.fromEmail,
        to: email,
        subject: 'Password Reset Request - BLD Cebu Online Portal',
        html: this.getPasswordResetEmailTemplate(userName || 'User', resetUrl),
      });

      // Use Node.js https module for Resend API
      const response = await new Promise<{ statusCode: number; statusMessage: string; data: string }>((resolve, reject) => {
        const options = {
          hostname: 'api.resend.com',
          port: 443,
          path: '/emails',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(emailData),
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

        req.write(emailData);
        req.end();
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`Resend API error: ${response.statusCode} ${response.statusMessage} - ${response.data}`);
      }

      this.logger.log(`Password reset email sent to ${email}`);
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      // Don't throw - allow the flow to continue even if email fails
      // In development, log the reset link
      this.logger.log(`Password reset link for ${email}: ${resetLink}`);
      return { sent: false, resetLink };
    }
  }

  /**
   * Send password reset SMS (via Resend SMS or other provider)
   * Note: Resend doesn't support SMS directly, but this is a placeholder for future SMS integration
   */
  async sendPasswordResetSMS(
    phone: string,
    resetToken: string,
  ): Promise<{ sent: boolean; resetLink?: string }> {
    const resetLink = `${this.frontendUrl}/reset-password?token=${resetToken}`;
    // TODO: Implement SMS sending via Twilio, Resend SMS, or other provider
    this.logger.warn('SMS sending not yet implemented');
    // For now, log the reset link (not secure, but functional for development)
    this.logger.log(`Password reset link for ${phone}: ${resetLink}`);
    return { sent: false, resetLink };
  }

  /**
   * Get password reset email HTML template
   */
  private getPasswordResetEmailTemplate(userName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - BLD Cebu Online Portal</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(to right, #9333ea, #7c3aed); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">BLD Cebu Online Portal</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; margin-top: 0;">Password Reset Request</h2>
            <p>Hello ${userName},</p>
            <p>We received a request to reset your password for your BLD Cebu Online Portal account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(to right, #9333ea, #7c3aed); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Reset Password</a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #9333ea; font-size: 12px; word-break: break-all;">${resetUrl}</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Important:</strong> This link will expire in 15 minutes. If you didn't request a password reset, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated message from BLD Cebu Online Portal. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}

