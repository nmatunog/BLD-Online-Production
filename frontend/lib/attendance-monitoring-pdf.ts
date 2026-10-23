import jsPDF from 'jspdf';
import type { AttendanceMonitoringReport } from '@/services/reports.service';
import { formatAttendedHeld, formatGeneratedAt, formatPct, periodLabel } from './attendance-monitoring';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 12;
const NAVY: [number, number, number] = [30, 58, 95];
const ORANGE: [number, number, number] = [194, 65, 12];
const SLATE: [number, number, number] = [51, 65, 85];
const ROW_ALT: [number, number, number] = [241, 245, 249];
const AVG_BG: [number, number, number] = [226, 232, 240];

function addFooter(doc: jsPDF, page: number, total: number, period: string) {
  const y = PAGE_HEIGHT - 10;
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'normal');
  doc.text(
    '% = attended ÷ held after community start. Attendance follows the member. WSC each date uses the ministry they belonged to that day. YTD WSC same rule. — = no eligible sessions. Orange = below 50%.',
    MARGIN,
    y - 4,
    { maxWidth: PAGE_WIDTH - MARGIN * 2 },
  );
  doc.text(`BLD Cebu · Attendance Report · ${period}`, MARGIN, y + 2);
  doc.text(`Page ${page} of ${total}`, PAGE_WIDTH - MARGIN, y + 2, { align: 'right' });
}

export function downloadAttendanceMonitoringPdf(report: AttendanceMonitoringReport): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const period = periodLabel(report.year, report.month);
  const ministry = report.ministry || 'All';
  const generated = formatGeneratedAt(report.generatedAt);

  const colX = [MARGIN, 62, 96, 118, 140, 160, 178, 196];
  const headers = ['Member', 'Ministry', 'CW att/held', 'CW %', 'WSC att/held', 'WSC %', 'YTD CW', 'YTD WSC'];

  const rows: Array<{
    cells: string[];
    kind: 'member' | 'average';
    lowCw?: boolean;
    lowWsc?: boolean;
  }> = [];
  for (const group of report.groups) {
    for (const member of group.members) {
      rows.push({
        kind: 'member',
        lowCw: member.cw.pct != null && member.cw.pct < 50,
        lowWsc: member.wsc.pct != null && member.wsc.pct < 50,
        cells: [
          member.ministryNote ? `${member.name} (${member.ministryNote})` : member.name,
          group.ministry,
          formatAttendedHeld(member.cw.attended, member.cw.held),
          formatPct(member.cw.pct),
          formatAttendedHeld(member.wsc.attended, member.wsc.held),
          formatPct(member.wsc.pct),
          formatPct(member.ytdCw.pct),
          formatPct(member.ytdWsc.pct),
        ],
      });
    }
    rows.push({
      kind: 'average',
      cells: [
        `${group.ministry} average`,
        '',
        '',
        formatPct(group.avgCwPct),
        '',
        formatPct(group.avgWscPct),
        formatPct(group.avgYtdCwPct),
        formatPct(group.avgYtdWscPct),
      ],
    });
  }

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text('BLD Cebu — Attendance Report', MARGIN, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...SLATE);
    doc.text('Community Worship (CW) & WSC', MARGIN, 22);

    doc.setFontSize(9);
    doc.text(`Period: ${period}`, PAGE_WIDTH - MARGIN, 14, { align: 'right' });
    doc.text(`Ministry: ${ministry}`, PAGE_WIDTH - MARGIN, 19, { align: 'right' });
    doc.text(`Generated: ${generated}`, PAGE_WIDTH - MARGIN, 24, { align: 'right' });

    const boxY = 28;
    const boxW = (PAGE_WIDTH - MARGIN * 2 - 9) / 4;
    const boxes = [
      { label: 'Members', value: String(report.summary.members) },
      {
        label: `Avg CW (YTD ${formatPct(report.summary.ytdAvgCwPct)})`,
        value: formatPct(report.summary.avgCwPct),
      },
      {
        label: `Avg WSC (YTD ${formatPct(report.summary.ytdAvgWscPct)})`,
        value: formatPct(report.summary.avgWscPct),
      },
      {
        label: 'Sessions held / cancelled',
        value: `${report.summary.sessionsHeld} / ${report.summary.cancelled}`,
      },
    ];
    boxes.forEach((box, i) => {
      const x = MARGIN + i * (boxW + 3);
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, boxY, boxW, 14, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...NAVY);
      doc.text(box.value, x + 2, boxY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...SLATE);
      doc.text(box.label, x + 2, boxY + 11, { maxWidth: boxW - 4 });
    });

    const headerY = 46;
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN, headerY, PAGE_WIDTH - MARGIN * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => {
      doc.text(h, colX[i], headerY + 5.5);
    });
    return headerY + 8;
  };

  let y = drawHeader();
  const rowH = 7;

  rows.forEach((row, idx) => {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage();
      y = drawHeader();
    }
    if (row.kind === 'average') {
      doc.setFillColor(...AVG_BG);
    } else if (idx % 2 === 1) {
      doc.setFillColor(...ROW_ALT);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, rowH, 'F');
    doc.setFont('helvetica', row.kind === 'average' ? 'bold' : 'normal');
    doc.setFontSize(8);
    row.cells.forEach((cell, i) => {
      if ((i === 3 && row.lowCw) || (i === 5 && row.lowWsc)) {
        doc.setTextColor(...ORANGE);
      } else {
        doc.setTextColor(...NAVY);
      }
      doc.text(cell, colX[i], y + 4.8, { maxWidth: i === 0 ? 48 : 20 });
    });
    y += rowH;
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    addFooter(doc, p, pageCount, period);
  }

  doc.save(`BLD Attendance Monitoring ${period}.pdf`);
}
