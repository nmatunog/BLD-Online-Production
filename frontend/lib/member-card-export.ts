import * as XLSX from 'xlsx';

export type PrinterExportRow = {
  name: string;
  communityId: string;
  ministry: string;
  photoUrl: string;
  nfcUrl: string;
};

export const PRINTER_HEADERS = ['name', 'communityId', 'ministry', 'photoUrl', 'nfcUrl'] as const;

export function toPrinterRows(
  rows: Array<{
    name: string;
    communityId: string;
    ministry?: string | null;
    photoUrl?: string | null;
    nfcUrl: string;
  }>,
): PrinterExportRow[] {
  return rows.map((row) => ({
    name: row.name,
    communityId: row.communityId,
    ministry: row.ministry ?? '',
    photoUrl: row.photoUrl ?? '',
    nfcUrl: row.nfcUrl,
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
      [row.name, row.communityId, row.ministry, row.photoUrl, row.nfcUrl].map(escape).join(','),
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

export function downloadBytes(filename: string, bytes: BlobPart, mime: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
