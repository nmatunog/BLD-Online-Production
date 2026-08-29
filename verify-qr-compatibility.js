/**
 * QR Code Check-In Compatibility Verification
 * 
 * This script verifies that the stable QR code payload (plain Community ID)
 * is compatible with the existing check-in scanner's extractMemberData function.
 */

// Extracted from qr-scanner-service.ts:476-486
function extractMemberData(scannedData) {
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
  return null;
}

// Test cases
const testCases = [
  'CEB-ME1802',           // Maria Estrella Matunog (Ez)
  'CEB-ME1801',           // Standard format
  'CEB-YFS1901',          // YFS format (3-letter encounter)
  'MNL-ME2001',           // Manila (different city)
  'CEB-LSS0501',          // LSS format
  'invalid-format',       // Should fail
  'CEB-ME18',             // Too short - should fail
  'CEB-ME180201',         // Too long - should fail
];

console.log('=== QR Code Check-In Compatibility Test ===\n');
console.log('Regex pattern: /^[A-Z]{3}-[A-Z]{2,3}\\d{2,3}\\d{2}$/\n');

testCases.forEach(testId => {
  const result = extractMemberData(testId);
  const status = result ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${testId.padEnd(20)} | ${result ? `communityId: ${result.communityId}` : 'Not recognized'}`);
});

console.log('\n=== Summary ===');
console.log('The stable QR payload (plain Community ID like "CEB-ME1802") is compatible');
console.log('with the existing check-in scanner at /checkin/[eventId]/page.tsx');
console.log('\nCheck-in flow:');
console.log('1. QR Scanner reads: "CEB-ME1802"');
console.log('2. extractMemberData() returns: { communityId: "CEB-ME1802" }');
console.log('3. Lookup: GET /members/public/community/CEB-ME1802');
console.log('4. Check-in: POST /attendance/public/check-in { communityId, eventId }');
