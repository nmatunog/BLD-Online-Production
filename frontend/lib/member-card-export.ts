import * as XLSX from 'xlsx';

export type PrinterExportRow = {
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  bloodType: string;
  photoUrl: string;
  verifyUrl: string;
};

export const PRINTER_HEADERS = [
  'memberId',
  'fullName',
  'firstName',
  'lastName',
  'bloodType',
  'photoUrl',
  'verifyUrl',
] as const;

export function toPrinterRows(
  rows: Array<{
    memberId?: string | null;
    communityId?: string | null;
    fullName?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    bloodType?: string | null;
    photoUrl?: string | null;
    verifyUrl?: string | null;
    nfcUrl?: string | null;
  }>,
): PrinterExportRow[] {
  return rows.map((row) => ({
    memberId: row.memberId || row.communityId || '',
    fullName: row.fullName || row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
    firstName: row.firstName || '',
    lastName: row.lastName || '',
    bloodType: row.bloodType || '',
    photoUrl: row.photoUrl || '',
    verifyUrl: row.verifyUrl || row.nfcUrl || '',
  }));
}

export function buildPrinterCsv(rows: PrinterExportRow[]): string {
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [
    PRINTER_HEADERS.join(','),
    ...rows.map((row) => PRINTER_HEADERS.map((key) => escape(row[key])).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

export function buildPrinterWorkbook(rows: PrinterExportRow[]): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRINTER_HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'ID Print');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

function canShareFiles(file: File): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof nav.canShare !== 'function' || typeof nav.share !== 'function') {
    return false;
  }
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function downloadBytes(filename: string, bytes: BlobPart, mime: string): Promise<void> {
  const blob = new Blob([bytes], { type: mime });
  const file = typeof File === 'undefined' ? null : new File([blob], filename, { type: mime });

  if (file && canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
    }
  }

  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
