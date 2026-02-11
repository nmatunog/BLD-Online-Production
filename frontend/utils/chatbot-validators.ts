// Chatbot Input Validators
// Validates user input during chatbot signup conversation

interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

export const validateName = (name: string): ValidationResult => {
  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters long' };
  }
  if (!/^[A-Za-z\s'-]+$/.test(name.trim())) {
    return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
  }
  return { valid: true, normalized: name.trim() };
};

/** Inputs that map to Cebu (Community ID CEB) */
const CEBU_ALIASES = ['talisay', 'don bosco', 'holy family', 'schoenstatt'];

export const validateLocation = (location: string): ValidationResult => {
  if (!location || !location.trim()) {
    return {
      valid: false,
      error: 'Please enter the BLD District or location (Outreach/ DIP) where you attended your encounter',
    };
  }

  const raw = location.trim();
  const lower = raw.toLowerCase();
  // Normalize Cebu aliases to "Cebu" so Community ID is CEB-...
  if (CEBU_ALIASES.some((alias) => lower.includes(alias))) {
    return { valid: true, normalized: 'Cebu' };
  }

  const titleCased = raw
    .split(/\s+/)
    .map((word) => {
      if (!word.length) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');

  return { valid: true, normalized: titleCased };
};

export const validateEncounterType = (type: string): ValidationResult => {
  const validTypes = ['ME', 'SE', 'SPE', 'YE'];
  const normalized = type.trim().toUpperCase();

  if (!validTypes.includes(normalized)) {
    return {
      valid: false,
      error: `Please choose one of: ME (Marriage Encounter), SE (Singles Encounter), SPE (Single Parents Encounter), or YE (Youth Encounter)`,
    };
  }

  return { valid: true, normalized };
};

export const validateEncounterNumber = (number: string): ValidationResult => {
  const num = parseInt(number, 10);
  if (isNaN(num) || num < 1 || num > 9999) {
    return { valid: false, error: 'Encounter number must be between 1 and 9999 (e.g., 30, 1801)' };
  }
  return { valid: true, normalized: num.toString() };
};

export const validateEmail = (email: string): ValidationResult => {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address (e.g., user@example.com)' };
  }
  return { valid: true, normalized: email.trim().toLowerCase() };
};

export const validatePhone = (phone: string): ValidationResult => {
  if (!phone || !phone.trim()) {
    return { valid: false, error: 'Phone number is required' };
  }

  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  cleaned = cleaned.replace(/^[^\d\+]+|[^\d]+$/g, '');

  if (cleaned.startsWith('09') && cleaned.length === 11) {
    cleaned = '+63' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+63' + cleaned;
  } else if (cleaned.startsWith('63') && cleaned.length === 12 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('+63') && cleaned.length === 13) {
    // Already correct
  } else if (cleaned.startsWith('63') && cleaned.length === 13 && !cleaned.startsWith('+')) {
    return {
      valid: false,
      error: 'Phone number appears to have an extra digit. Please check: Philippine mobile numbers should be 10 digits after the country code (e.g., 09123456789 or +639123456789)',
    };
  }

  if (!/^\+?\d+$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Phone number can only contain numbers and a + sign. Please enter a valid phone number (e.g., 09123456789 or +639123456789)',
    };
  }

  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      cleaned = '+63' + cleaned;
    } else {
      return {
        valid: false,
        error: 'Phone number must include country code. For Philippines, use format: 09123456789 or +639123456789',
      };
    }
  }

  if (cleaned.startsWith('+63')) {
    const digitsAfterCountryCode = cleaned.substring(3);
    if (digitsAfterCountryCode.length !== 10) {
      return {
        valid: false,
        error: `Philippine mobile numbers must have exactly 10 digits after the country code. You entered ${digitsAfterCountryCode.length} digits. Please check your number (e.g., 09123456789 or +639123456789)`,
      };
    }

    if (!digitsAfterCountryCode.startsWith('9')) {
      return {
        valid: false,
        error: 'Philippine mobile numbers must start with 9. Please check your number (e.g., 09123456789 or +639123456789)',
      };
    }

    const digitPattern = /(\d)\1{4,}/;
    if (digitPattern.test(digitsAfterCountryCode)) {
      return {
        valid: false,
        error: 'Phone number appears to have repeated digits. Please double-check your number (e.g., 09123456789 or +639123456789)',
      };
    }
  }

  return { valid: true, normalized: cleaned };
};

export interface ExtractedInformation {
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  encounterType: string | null;
  location: string | null;
  encounterNumber: string | null;
  email: string | null;
  phone: string | null;
}

export const extractInformation = (input: string): ExtractedInformation => {
  const extracted: ExtractedInformation = {
    firstName: null,
    lastName: null,
    middleName: null,
    encounterType: null,
    location: null,
    encounterNumber: null,
    email: null,
    phone: null,
  };

  const lowerInput = input.toLowerCase();

  const encounterTypePatterns = [
    /(?:encounter type|type|encounter|attended)\s*(?:is|was|:)?\s*(me|se|spe|ye|marriage encounter|singles encounter|single parents encounter|youth encounter)/i,
    /\b(me|se|spe|ye)\b/i,
  ];

  for (const pattern of encounterTypePatterns) {
    const match = input.match(pattern);
    if (match) {
      const typeStr = match[1].toUpperCase();
      const typeMap: Record<string, string> = {
        ME: 'ME',
        'MARRIAGE ENCOUNTER': 'ME',
        MARRIAGE: 'ME',
        SE: 'SE',
        'SINGLES ENCOUNTER': 'SE',
        SINGLES: 'SE',
        SPE: 'SPE',
        'SINGLE PARENTS ENCOUNTER': 'SPE',
        'SINGLE PARENTS': 'SPE',
        'SINGLE PARENT': 'SPE',
        YE: 'YE',
        'YOUTH ENCOUNTER': 'YE',
        YOUTH: 'YE',
      };
      const mappedType = typeMap[typeStr] || typeStr;
      if (['ME', 'SE', 'SPE', 'YE'].includes(mappedType)) {
        extracted.encounterType = mappedType;
      }
      break;
    }
  }

  const namePatterns = [
    /(?:my name is|i'm|i am|name:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)$/i,
  ];

  for (const pattern of namePatterns) {
    const match = input.match(pattern);
    if (match) {
      const nameParts = match[1].trim().split(/\s+/);
      if (nameParts.length >= 2) {
        extracted.firstName = nameParts[0];
        extracted.lastName = nameParts[nameParts.length - 1];
        if (nameParts.length > 2) {
          extracted.middleName = nameParts.slice(1, -1).join(' ');
        }
      }
      break;
    }
  }

  const locationPatterns = [
    /(?:from|in|location:|encounter in|attended in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /(?:cebu|manila|davao|cagayan de oro|iloilo|bacolod)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = input.match(pattern);
    if (match) {
      const locResult = validateLocation(match[1] || match[0]);
      if (locResult.valid && locResult.normalized) {
        extracted.location = locResult.normalized;
      }
      break;
    }
  }

  const classNumberPatterns = [
    /(?:class number|class|number|#)\s*:?\s*(\d{1,4})/i,
    /(?:class|number)\s+(\d{1,4})/i,
    /\b(\d{1,4})\b/,
  ];

  for (const pattern of classNumberPatterns) {
    const match = input.match(pattern);
    if (match) {
      const numResult = validateEncounterNumber(match[1]);
      if (numResult.valid && numResult.normalized) {
        extracted.encounterNumber = numResult.normalized;
      }
      break;
    }
  }

  const emailMatch = input.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    const emailResult = validateEmail(emailMatch[1]);
    if (emailResult.valid && emailResult.normalized) {
      extracted.email = emailResult.normalized;
    }
  }

  const phoneMatch = input.match(/(\+?[\d\s\-\(\)]{10,15})/);
  if (phoneMatch) {
    const phoneResult = validatePhone(phoneMatch[1]);
    if (phoneResult.valid && phoneResult.normalized) {
      extracted.phone = phoneResult.normalized;
    }
  }

  return extracted;
};

