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
 * Generate stable QR code for a member using only Community ID
 * 
 * This QR code is stable and can be printed on ID cards. The payload is just
 * the Community ID string (e.g., "CEB-ME1802") with no timestamp or dynamic data.
 * 
 * **Check-in Compatibility:**
 * - The QR scanner at `/checkin/[eventId]` calls `qrUtils.extractMemberData()`
 * - `extractMemberData()` accepts plain Community ID strings matching pattern:
 *   `/^[A-Z]{3}-[A-Z]{2,3}\d{2,3}\d{2}$/` (e.g., CEB-ME1802)
 * - After parsing, the scanner calls `/members/public/community/:id` lookup
 * - Then checks in via `POST /attendance/public/check-in` with `{ communityId, eventId }`
 * 
 * This stable payload works for both on-screen QR (signup result) and printed
 * ID card back, allowing members to check in by scanning either their phone or
 * physical ID card at any event.
 * 
 * @see qr-scanner-service.ts:476-486 for plain Community ID parsing
 * @see app/checkin/[eventId]/page.tsx:187-207 for check-in scanner usage
 */
export async function generateStableMemberQR(
  communityId: string,
  options?: {
    width?: number;
    margin?: number;
  }
): Promise<string> {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(communityId, {
      width: options?.width || 256,
      margin: options?.margin ?? 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating stable QR code:', error);
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

