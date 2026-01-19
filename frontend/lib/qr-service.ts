// QR Code Generation Service for Members
import QRCode from 'qrcode';

export interface MemberQRData {
  type: 'member';
  communityId: string;
  name: string;
  email?: string | null;
  timestamp: number;
}

export interface MemberData {
  communityId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
  email?: string | null;
}

/**
 * Generate QR code for a member
 */
export async function generateMemberQR(memberData: MemberData): Promise<string> {
  try {
    // Construct member name
    const memberName = memberData.name || 
      (memberData.nickname 
        ? `${memberData.nickname} ${memberData.lastName || ''}`.trim()
        : `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim());

    const qrData: MemberQRData = {
      type: 'member',
      communityId: memberData.communityId,
      name: memberName,
      email: memberData.email || null,
      timestamp: Date.now(),
    };

    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Download QR code as PNG file
 */
export function downloadQRCode(dataURL: string, communityId: string): void {
  const link = document.createElement('a');
  link.download = `qr-${communityId}.png`;
  link.href = dataURL;
  link.click();
}

