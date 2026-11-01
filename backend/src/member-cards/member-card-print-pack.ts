import JSZip from 'jszip';

/** A print pack is for test runs and small batches, so keep it small and fast. */
export const PRINT_PACK_MAX_MEMBERS = 50;

export const PRINT_PACK_CSV_COLUMNS = [
  'memberId',
  'fullName',
  'firstName',
  'lastName',
  'bloodType',
  'photoFile',
  'qrFile',
  'verifyUrl',
] as const;

const DEFAULT_PHOTO_HOSTS = ['bld-idphotos.b-cdn.net'];

export type PrintPackCard = {
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  bloodType: string;
  verifyUrl: string;
  photo: Buffer;
  qr: Buffer;
};

export type PrintPackSkip = {
  memberId: string;
  fullName: string;
  reason: string;
};

/** Hosts we will download ID photos from (BunnyCDN pull zone only — never arbitrary URLs). */
export function allowedPhotoHosts(cdnUrl?: string | null): string[] {
  const hosts = new Set(DEFAULT_PHOTO_HOSTS);
  if (cdnUrl) {
    try {
      hosts.add(new URL(cdnUrl).hostname.toLowerCase());
    } catch {
      // Ignore a malformed env value; the default host still applies.
    }
  }
  return [...hosts];
}

export function isAllowedPhotoUrl(photoUrl: string | null | undefined, hosts: string[]): boolean {
  if (!photoUrl) return false;
  try {
    const url = new URL(photoUrl);
    return url.protocol === 'https:' && hosts.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Safe file stem from a member ID, e.g. "CEB-ME1801". */
export function printPackFileStem(memberId: string): string {
  return memberId.toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'member';
}

/**
 * CSV cell, quoted when needed. A leading = + - @ (or tab/CR) is neutralised with an
 * apostrophe so a member-entered name can never run as a spreadsheet formula.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(header: readonly string[], rows: string[][]): string {
  const lines = [header.join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  // BOM so Excel and card-printing software read names like "Peñaflor" correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

const README = `BLD Cebu ID print pack
======================

cards.csv     One row per card. photoFile and qrFile point to the images below.
photos/       ID photos (JPEG), named by member ID.
qr/           QR codes (PNG, black on white), named by member ID.
skipped.csv   Members left out of this pack and why (only present if any).

Card size: CR80 / standard ID card, 85.6 x 54 mm.
QR codes open the member's verify page (photo, name, member ID, ministry,
VALID/REVOKED). Print each QR at least 18 x 18 mm and keep the white border
around it so phones can scan it.
`;

export async function buildPrintPackZip(input: {
  cards: PrintPackCard[];
  skipped: PrintPackSkip[];
}): Promise<Buffer> {
  const zip = new JSZip();
  const used = new Map<string, number>();
  const rows: string[][] = [];

  for (const card of input.cards) {
    let stem = printPackFileStem(card.memberId);
    const seen = used.get(stem) ?? 0;
    used.set(stem, seen + 1);
    if (seen > 0) stem = `${stem}-${seen + 1}`;

    const photoFile = `photos/${stem}.jpg`;
    const qrFile = `qr/${stem}.png`;
    zip.file(photoFile, card.photo);
    zip.file(qrFile, card.qr);
    rows.push([
      card.memberId,
      card.fullName,
      card.firstName,
      card.lastName,
      card.bloodType,
      photoFile,
      qrFile,
      card.verifyUrl,
    ]);
  }

  zip.file('cards.csv', toCsv(PRINT_PACK_CSV_COLUMNS, rows));
  if (input.skipped.length > 0) {
    zip.file(
      'skipped.csv',
      toCsv(
        ['memberId', 'fullName', 'reason'],
        input.skipped.map((skip) => [skip.memberId, skip.fullName, skip.reason]),
      ),
    );
  }
  zip.file('README.txt', README);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
