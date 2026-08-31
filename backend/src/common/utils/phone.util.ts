/**
 * Phone number normalization utility
 * Normalizes Philippine phone numbers to 09XXXXXXXXX format (11 digits)
 */

export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone || !phone.trim()) {
    return null;
  }

  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  cleaned = cleaned.replace(/^[^\d\+]+|[^\d]+$/g, '');

  if (cleaned.startsWith('09') && cleaned.length === 11) {
    return cleaned;
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    return '0' + cleaned;
  } else if (cleaned.startsWith('+639') && cleaned.length === 13) {
    return '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('639') && cleaned.length === 12) {
    return '0' + cleaned.substring(2);
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    return '0' + cleaned.substring(2);
  }

  return cleaned.length === 11 && cleaned.startsWith('09') ? cleaned : null;
}

/**
 * Convert 09XXXXXXXXX to legacy E.164 format (+639XXXXXXXXX) for backward-compatible lookups
 */
export function phoneToE164(phone: string): string | null {
  if (!phone || !phone.startsWith('09') || phone.length !== 11) {
    return null;
  }
  return '+63' + phone.substring(1);
}

