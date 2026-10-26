import * as XLSX from 'xlsx';

export type PrinterExportRow = {
  name: string;
  communityId: string;
  ministry: string;
  photoUrl: string;
  nfcUrl: string;
  cardStatus: string;
};

export const PRINTER_HEADERS = [
  'name',
  'communityId',
  'ministry',
  'photoUrl',
  'nfcUrl',
  'cardStatus',
] as const;

export function toPrinterRows(
  rows: Array<{
    name: string;
    communityId: string;
    ministry?: string | null;
    photoUrl?: string | null;
    nfcUrl?: string | null;
    cardStatus?: string | null;
    status?: string | null;
  }>,
): PrinterExportRow[] {
  return rows.map((row) => ({
    name: row.name,
    communityId: row.communityId,
    ministry: row.ministry ?? '',
    photoUrl: row.photoUrl ?? '',
    nfcUrl: row.nfcUrl ?? '',
    cardStatus: row.cardStatus ?? row.status ?? '',
  }));
}

export function buildPrinterCsv(rows: PrinterExportRow[]): string {
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [
    PRINTER_HEADERS.join(','),
    ...rows.map((row) =>
      [row.name, row.communityId, row.ministry, row.photoUrl, row.nfcUrl, row.cardStatus]
        .map(escape)
        .join(','),
    ),
  ];
  return `${lines.join('\n')}\n`;
}

export function buildPrinterWorkbook(rows: PrinterExportRow[]): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRINTER_HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'NFC Cards');
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
  if (typeof document === 'undefined') return;
  const blob = new Blob([bytes], { type: mime });
  const file = new File([blob], filename, { type: mime });

  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
