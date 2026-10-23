'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { reportsService, type AttendanceMonitoringReport, type WeekMark } from '@/services/reports.service';
import { MINISTRIES_BY_APOSTOLATE } from '@/lib/member-constants';
import { downloadAttendanceMonitoringPdf } from '@/lib/attendance-monitoring-pdf';
import {
  MONTH_NAMES,
  formatAttendedHeld,
  formatPct,
  isLowPct,
  manilaTodayParts,
  periodLabel,
} from '@/lib/attendance-monitoring';
import { getErrorMessage } from '@/lib/get-error-message';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR'];
const ALL = 'all';

function officialMinistries(): string[] {
  return Object.values(MINISTRIES_BY_APOSTOLATE).flat();
}

function WeekDots({
  marks,
  label,
  weekMinistries,
}: {
  marks: WeekMark[];
  label: string;
  weekMinistries?: Array<string | null>;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-label={label}>
      {marks.length === 0 ? (
        <span className="text-base text-slate-500">—</span>
      ) : (
        marks.map((mark, i) => {
          const prior = weekMinistries?.[i];
          const title = prior
            ? `${label} week ${i + 1}: ${mark} (while in ${prior})`
            : `${label} week ${i + 1}: ${mark === 'not_yet_member' ? 'not yet a member' : mark}`;
          if (mark === 'attended') {
            return (
              <span
                key={`${mark}-${i}`}
                title={title}
                className={`inline-block h-3.5 w-3.5 rounded-full bg-blue-600 ${prior ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                aria-label={title}
              />
            );
          }
          if (mark === 'absent') {
            return (
              <span
                key={`${mark}-${i}`}
                title={title}
                className={`inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-400 bg-white ${prior ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`}
                aria-label={title}
              />
            );
          }
          if (mark === 'not_yet_member') {
            return (
              <span
                key={`${mark}-${i}`}
                title={title}
                className="inline-block h-3.5 w-3.5 rounded-full border border-dashed border-slate-400 bg-slate-50"
                aria-label={title}
              />
            );
          }
          return (
            <span
              key={`${mark}-${i}`}
              title={title}
              className="inline-block h-3.5 w-3.5 rounded-full bg-slate-300"
              aria-label={title}
            />
          );
        })
      )}
    </div>
  );
}

function PctBar({ pct, low }: { pct: number | null; low: boolean }) {
  const width = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
      <div
        className={`h-full rounded-full ${low ? 'bg-orange-500' : 'bg-blue-600'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function AttendanceMonitoringPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-lg text-slate-600">
          <Loader2 className="mr-3 h-6 w-6 animate-spin" aria-hidden />
          Loading Attendance Monitoring…
        </div>
      }
    >
      <AttendanceMonitoringContent />
    </Suspense>
  );
}

function AttendanceMonitoringContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const today = useMemo(() => manilaTodayParts(), []);

  const year = Number(searchParams.get('year') || today.year);
  const monthParam = searchParams.get('month');
  const month = monthParam === ALL || monthParam === '' ? null : Number(monthParam || today.month);
  const ministryParam = searchParams.get('ministry') || ALL;

  const [report, setReport] = useState<AttendanceMonitoringReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  const canAccess =
    !!user?.role &&
    ADMIN_ROLES.includes(user.role) &&
    (user.role !== 'MINISTRY_COORDINATOR' || Boolean(user.ministry?.trim()));
  const coordinatorLocked = user?.role === 'MINISTRY_COORDINATOR';
  const ministries = useMemo(() => {
    const set = new Set(officialMinistries());
    report?.groups.forEach((g) => {
      if (g.ministry) set.add(g.ministry);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [report]);

  const setQuery = useCallback(
    (next: { year?: number; month?: number | null; ministry?: string }) => {
      const params = new URLSearchParams();
      params.set('year', String(next.year ?? year));
      const nextMonth = next.month === undefined ? month : next.month;
      params.set('month', nextMonth == null ? ALL : String(nextMonth));
      const nextMinistry = next.ministry ?? ministryParam;
      if (nextMinistry && nextMinistry !== ALL) params.set('ministry', nextMinistry);
      router.replace(`/reports/attendance-monitoring?${params.toString()}`);
    },
    [router, year, month, ministryParam],
  );

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = {
      year,
      ...(month ? { month } : {}),
      ...(ministryParam !== ALL ? { ministry: ministryParam } : {}),
    };
    reportsService
      .getAttendanceMonitoring(params)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error('Could not load attendance monitoring', {
            description: getErrorMessage(error, 'Please try again.'),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess, year, month, ministryParam]);

  const handlePdf = async () => {
    if (!report) return;
    setExporting('pdf');
    try {
      downloadAttendanceMonitoringPdf(report);
    } finally {
      setExporting(null);
    }
  };

  const handleExcel = async () => {
    setExporting('xlsx');
    try {
      await reportsService.downloadAttendanceMonitoringExport({
        year,
        ...(month ? { month } : {}),
        ...(ministryParam !== ALL ? { ministry: ministryParam } : {}),
        format: 'xlsx',
      });
    } catch (error) {
      toast.error('Could not download Excel', {
        description: getErrorMessage(error, 'Please try again.'),
      });
    } finally {
      setExporting(null);
    }
  };

  if (user && !canAccess) {
    return (
      <div className="min-h-screen bg-slate-50">
        <DashboardHeader />
        <div className="mx-auto max-w-lg p-6 text-center">
          <Card>
            <CardContent className="p-8">
              <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
              <p className="mt-2 text-lg text-slate-600">
                Attendance Monitoring is available to administrators only.
              </p>
              <Button asChild className="mt-6">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const years = Array.from({ length: 8 }, (_, i) => today.year - i);

  return (
    <div className="min-h-screen bg-slate-50 text-lg text-slate-900">
      <DashboardHeader />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/reports"
              className="mb-2 inline-flex items-center gap-1 text-base font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Reports
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Attendance Monitoring
            </h1>
            <p className="mt-1 text-lg text-slate-600">
              BLD Cebu · Community Worship (CW) and Word Sharing Circle (WSC)
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handlePdf}
              disabled={!report || exporting !== null}
              className="h-12 min-w-[10rem] bg-slate-900 text-base text-white hover:bg-slate-800"
            >
              {exporting === 'pdf' ? <Loader2 className="animate-spin" /> : <Download />}
              Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExcel}
              disabled={!report || exporting !== null}
              className="h-12 min-w-[10rem] border-slate-300 bg-white text-base"
            >
              {exporting === 'xlsx' ? <Loader2 className="animate-spin" /> : <Download />}
              Download Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <div>
            <Label htmlFor="year" className="text-base font-semibold text-slate-800">
              Year
            </Label>
            <Select value={String(year)} onValueChange={(value) => setQuery({ year: Number(value) })}>
              <SelectTrigger id="year" className="mt-1 h-12 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-lg">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month" className="text-base font-semibold text-slate-800">
              Month
            </Label>
            <Select
              value={month == null ? ALL : String(month)}
              onValueChange={(value) => setQuery({ month: value === ALL ? null : Number(value) })}
            >
              <SelectTrigger id="month" className="mt-1 h-12 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-lg">
                  All
                </SelectItem>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)} className="text-lg">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ministry" className="text-base font-semibold text-slate-800">
              Ministry
            </Label>
            <Select
              value={coordinatorLocked ? user?.ministry || ALL : ministryParam}
              onValueChange={(value) => setQuery({ ministry: value })}
              disabled={coordinatorLocked}
            >
              <SelectTrigger id="ministry" className="mt-1 h-12 text-lg">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-lg">
                  All
                </SelectItem>
                {ministries.map((name) => (
                  <SelectItem key={name} value={name} className="text-lg">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-slate-700" role="status">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Loading {periodLabel(year, month)} attendance…
          </div>
        )}

        {report && !loading && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Members"
                value={String(report.summary.members)}
                hint={`${report.summary.ministries} ${report.summary.ministries === 1 ? 'ministry' : 'ministries'}`}
              />
              <SummaryCard
                label="Avg CW attendance"
                value={formatPct(report.summary.avgCwPct)}
                hint={`YTD ${formatPct(report.summary.ytdAvgCwPct)}`}
              />
              <SummaryCard
                label="Avg WSC attendance"
                value={formatPct(report.summary.avgWscPct)}
                hint={`YTD ${formatPct(report.summary.ytdAvgWscPct)}`}
              />
              <SummaryCard
                label="Sessions held"
                value={String(report.summary.sessionsHeld)}
                hint={`CW ${report.summary.cwHeld} · WSC ${report.summary.wscHeld} · ${report.summary.cancelled} cancelled`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-slate-700">
              <LegendDot className="bg-blue-600" label="attended" />
              <LegendDot className="border-2 border-slate-400 bg-white" label="absent" />
              <LegendDot className="bg-slate-300" label="cancelled (not counted)" />
              <LegendDot className="border border-dashed border-slate-400 bg-slate-50" label="not yet a member" />
              <span>CW = Community Worship</span>
            </div>
            <p className="text-base text-slate-600">
              Percent = attended ÷ sessions held after the member’s community start. Attendance follows the
              member to their current ministry. WSC on each date uses the ministry they belonged to that day
              (hover a ringed dot to see a previous ministry). YTD WSC uses the same rule. No eligible
              sessions = —. Cancelled sessions are excluded.
            </p>

            <div className="space-y-6 print:space-y-4">
              {report.groups.map((group) => (
                <section
                  key={group.ministry}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <header className="flex flex-col gap-1 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-bold text-slate-900">{group.ministry}</h2>
                    <p className="text-base font-medium text-slate-600">
                      avg CW {formatPct(group.avgCwPct)} · WSC {formatPct(group.avgWscPct)}
                    </p>
                  </header>

                  <div className="hidden divide-y divide-slate-100 md:block">
                    {group.members.map((member) => (
                      <div key={member.id} className="grid grid-cols-[minmax(12rem,1.2fr)_1.4fr_1.4fr_8rem] items-center gap-4 px-4 py-4">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{member.name}</p>
                          {member.ministryNote && (
                            <p className="mt-0.5 text-sm font-medium text-slate-600">{member.ministryNote}</p>
                          )}
                          {member.needsFollowUp && (
                            <span className="mt-1 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-sm font-medium text-orange-700">
                              needs follow-up
                            </span>
                          )}
                        </div>
                        <Track
                          label="CW"
                          attended={member.cw.attended}
                          held={member.cw.held}
                          pct={member.cw.pct}
                          weeks={member.cw.weeks}
                        />
                        <Track
                          label="WSC"
                          attended={member.wsc.attended}
                          held={member.wsc.held}
                          pct={member.wsc.pct}
                          weeks={member.wsc.weeks}
                          weekMinistries={member.wsc.weekMinistries}
                        />
                        <p className="text-right text-sm font-medium text-slate-600">
                          year to date
                          <br />
                          CW {formatPct(member.ytdCw.pct)} · WSC {formatPct(member.ytdWsc.pct)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-slate-100 md:hidden">
                    {group.members.map((member) => (
                      <article key={member.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold text-slate-900">{member.name}</h3>
                            {member.ministryNote && (
                              <p className="mt-0.5 text-sm font-medium text-slate-600">{member.ministryNote}</p>
                            )}
                          </div>
                          {member.needsFollowUp && (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-sm font-medium text-orange-700">
                              needs follow-up
                            </span>
                          )}
                        </div>
                        <Track
                          label="CW"
                          attended={member.cw.attended}
                          held={member.cw.held}
                          pct={member.cw.pct}
                          weeks={member.cw.weeks}
                        />
                        <Track
                          label="WSC"
                          attended={member.wsc.attended}
                          held={member.wsc.held}
                          pct={member.wsc.pct}
                          weeks={member.wsc.weeks}
                          weekMinistries={member.wsc.weekMinistries}
                        />
                        <p className="text-base text-slate-600">
                          Year to date · CW {formatPct(member.ytdCw.pct)} · WSC {formatPct(member.ytdWsc.pct)}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
              {report.groups.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-slate-600">
                    No members found for this filter.
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <p className="text-base font-medium text-slate-600">{label}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-base text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3.5 w-3.5 rounded-full ${className}`} aria-hidden />
      {label}
    </span>
  );
}

function Track({
  label,
  attended,
  held,
  pct,
  weeks,
  weekMinistries,
}: {
  label: string;
  attended: number;
  held: number;
  pct: number | null;
  weeks: WeekMark[];
  weekMinistries?: Array<string | null>;
}) {
  const low = isLowPct(pct);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-semibold text-slate-800">{label}</span>
        <span className={`font-bold ${low ? 'text-orange-700' : 'text-slate-900'}`}>{formatPct(pct)}</span>
      </div>
      <PctBar pct={pct} low={low} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <WeekDots marks={weeks} label={label} weekMinistries={weekMinistries} />
        <span className="text-sm text-slate-500">{formatAttendedHeld(attended, held)}</span>
      </div>
    </div>
  );
}
