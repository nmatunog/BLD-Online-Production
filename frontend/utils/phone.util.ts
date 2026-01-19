/**
 * Phone number normalization utility (Frontend)
 * Normalizes Philippine phone numbers to +639XXXXXXXXX format
 */

export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone || !phone.trim()) {
    return null;
  }

  // Remove all spaces, dashes, parentheses, and dots
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Remove any non-digit characters except +
  cleaned = cleaned.replace(/^[^\d\+]+|[^\d]+$/g, '');

  // Handle different Philippine phone number formats
  if (cleaned.startsWith('09') && cleaned.length === 11) {
    // Format: 09123456789 -> +639123456789
    cleaned = '+63' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 10 && !cleaned.startsWith('+')) {
    // Format: 9123456789 -> +639123456789
    cleaned = '+63' + cleaned;
  } else if (cleaned.startsWith('63') && cleaned.length === 12 && !cleaned.startsWith('+')) {
    // Format: 639123456789 -> +639123456789
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('+63') && cleaned.length === 13) {
    // Already in correct format: +639123456789
    // Do nothing
  } else if (!cleaned.startsWith('+')) {
    // If no + and starts with 9, assume it's a 10-digit number
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      cleaned = '+63' + cleaned;
    } else {
      // Invalid format, return as-is (will be caught by validation)
      return cleaned;
    }
  }

  // Validate final format
  if (cleaned.startsWith('+63')) {
    const digitsAfterCountryCode = cleaned.substring(3);
    if (digitsAfterCountryCode.length === 10) {
      return cleaned;
    }
  }

  // If we can't normalize, return the cleaned version
  // The validation layer will catch invalid formats
  return cleaned;
}

