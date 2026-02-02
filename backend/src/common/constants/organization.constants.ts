// BLD Cebu Organization Structure
// Organization: Apostolates > Ministries > Homesteads
// This structure is used throughout the backend for consistency

export const APOSTOLATES = [
  'Pastoral Apostolate',
  'Evangelization Apostolate',
  'Formation Apostolate',
  'Management Apostolate',
  'Mission Apostolate',
] as const;

export const MINISTRIES_BY_APOSTOLATE: Record<string, string[]> = {
  'Pastoral Apostolate': [
    'Pastoral Services',
    'Youth Ministry',
    'Singles Ministry',
    'Solo Parent Ministry',
    'Mark 10 Ministry',
    'Prayer Counseling and Healing Services (PCHS)',
  ],
  'Evangelization Apostolate': [
    'Marriage Encounter Program',
    'Family Encounter Program',
    'Life in the Spirit Ministry',
    'Praise Ministry',
    'Liturgy Ministry',
    'Post-LSS Group (PLSG)',
  ],
  'Formation Apostolate': [
    'Teaching Ministry',
    'Intercessory Ministry',
    'Discipling Ministry',
    'Word Ministry',
    'Witness Development Ministry',
    'Coach Development Ministry',
  ],
  'Management Apostolate': [
    'Service Ministry',
    'Treasury Ministry',
    'Secretariat Office',
    'Management Services',
    'Technical Group',
  ],
  'Mission Apostolate': [
    'Parish Services Ministry',
    'Institutional Services Ministry',
    'Scholarship of Hope Ministry',
    'Nazareth Housing Program',
    'Mission Homesteads',
    'Shepherds of Districts-in-Process',
  ],
};

// Homesteads are under Mission Homesteads (Mission Apostolate)
// This can be expanded as needed
export const HOMESTEADS: string[] = [
  // Add specific homesteads here as they are identified
  // Example: 'Homestead 1', 'Homestead 2', etc.
];

// Helper function to get ministries for an apostolate
export function getMinistriesForApostolate(apostolate: string): string[] {
  return MINISTRIES_BY_APOSTOLATE[apostolate] || [];
}

// Helper function to validate apostolate (case-insensitive for production)
export function isValidApostolate(apostolate: string): boolean {
  if (!apostolate || !apostolate.trim()) return false;
  return normalizeApostolate(apostolate) !== null;
}

// Normalize apostolate to canonical form (case-insensitive, trim) for production compatibility
export function normalizeApostolate(apostolate: string | null | undefined): string | null {
  if (!apostolate || !apostolate.trim()) return null;
  const key = apostolate.trim();
  const found = APOSTOLATES.find((a) => a.toLowerCase() === key.toLowerCase());
  return found ?? null;
}

// Normalize ministry to canonical form for a given apostolate (case-insensitive, trim)
export function normalizeMinistry(
  ministry: string | null | undefined,
  apostolate: string,
): string | null {
  if (!ministry || !ministry.trim()) return null;
  const ministries = getMinistriesForApostolate(apostolate);
  const key = ministry.trim();
  const found = ministries.find((m) => m.toLowerCase() === key.toLowerCase());
  return found ?? null;
}

// Helper function to validate ministry for an apostolate (case-insensitive for production)
export function isValidMinistryForApostolate(ministry: string, apostolate: string): boolean {
  if (!ministry || !ministry.trim()) return false;
  const canonicalApostolate = normalizeApostolate(apostolate);
  if (!canonicalApostolate) return false;
  return normalizeMinistry(ministry, canonicalApostolate) !== null;
}
