// Member-related constants and arrays from old system

export const APOSTOLATES = [
  'Pastoral Apostolate',
  'Evangelization Apostolate',
  'Formation Apostolate',
  'Management Apostolate',
  'Mission Apostolate',
  'Others',
] as const;

export const MINISTRIES_BY_APOSTOLATE: Record<string, string[]> = {
  'Pastoral Apostolate': [
    'Pastoral Services Ministry',
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
    'Scholarship of Hope',
    'Nazareth Housing Project',
    'Mission Homesteads',
    'Shepherds of Districts-in-Process',
  ],
  'Others': [
    'District Council of Stewards',
  ],
};

export const ENCOUNTER_TYPES = [
  { value: 'ME', label: 'Marriage Encounter (ME)' },
  { value: 'SE', label: 'Singles Encounter (SE)' },
  { value: 'SPE', label: 'Single Parents Encounter (SPE)' },
  { value: 'YE', label: 'Youth Encounter (YE)' },
] as const;

export const USER_ROLES = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'CLASS_SHEPHERD', label: 'Class Shepherd' },
  { value: 'MINISTRY_COORDINATOR', label: 'Ministry Coordinator' },
  { value: 'DCS', label: 'DCS' },
  { value: 'ADMINISTRATOR', label: 'Administrator' },
  { value: 'SUPER_USER', label: 'Super User' },
] as const;

export const MEMBER_STATUSES = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
] as const;

export const CIVIL_STATUSES = [
  { value: 'Single', label: 'Single' },
  { value: 'Married', label: 'Married' },
  { value: 'Widowed', label: 'Widowed' },
  { value: 'Solo Parent', label: 'Solo Parent' },
] as const;

export const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
] as const;

// Helper function to get ministries for an apostolate
export function getMinistriesForApostolate(apostolate: string): string[] {
  return MINISTRIES_BY_APOSTOLATE[apostolate] || [];
}

// Helper function to get encounter type display name
export function getEncounterTypeDisplay(shortType: string): string {
  const type = ENCOUNTER_TYPES.find(t => t.value === shortType);
  return type ? type.label : shortType;
}

// Helper function to get encounter type short value
export function getEncounterTypeShort(displayType: string): string {
  const type = ENCOUNTER_TYPES.find(t => t.label === displayType);
  return type ? type.value : displayType;
}

// Helper function to get role display name
export function getRoleDisplayName(role: string): string {
  const roleObj = USER_ROLES.find(r => r.value === role);
  return roleObj ? roleObj.label : role;
}

// Helper function to capitalize name
export function capitalizeName(name: string): string {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper function to capitalize location
export function capitalizeLocation(location: string): string {
  if (!location) return '';
  return location
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper function to get middle initial
export function getMiddleInitial(middleName: string | null | undefined): string {
  if (!middleName || !middleName.trim()) return '';
  return middleName.trim().charAt(0).toUpperCase() + '.';
}

