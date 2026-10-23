import type { AttendanceWeekSlot, WeekMark } from './attendance-monitoring.helpers';

export interface AttendanceBlock {
  attended: number;
  held: number;
  pct: number | null;
  weeks: WeekMark[];
  /** Previous ministry name when that week was scored against a prior assignment. */
  weekMinistries?: Array<string | null>;
}

export interface YtdBlock {
  attended: number;
  held: number;
  pct: number | null;
}

export interface AttendanceMonitoringMemberRow {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  ministry: string | null;
  attendanceStartDate: string | null;
  effectiveCommunityStart: string;
  joinedMinistryOn: string | null;
  ministryNote: string | null;
  cw: AttendanceBlock;
  wsc: AttendanceBlock;
  ytdCw: YtdBlock;
  ytdWsc: YtdBlock;
  needsFollowUp: boolean;
}

export interface AttendanceMonitoringGroup {
  ministry: string;
  avgCwPct: number | null;
  avgWscPct: number | null;
  avgYtdCwPct: number | null;
  avgYtdWscPct: number | null;
  members: AttendanceMonitoringMemberRow[];
}

export interface AttendanceMonitoringSummary {
  members: number;
  ministries: number;
  avgCwPct: number | null;
  avgWscPct: number | null;
  ytdAvgCwPct: number | null;
  ytdAvgWscPct: number | null;
  sessionsHeld: number;
  cwHeld: number;
  wscHeld: number;
  cancelled: number;
}

export interface AttendanceMonitoringReport {
  year: number;
  month: number | null;
  ministry: string | null;
  timezone: 'Asia/Manila';
  generatedAt: string;
  summary: AttendanceMonitoringSummary;
  weeks: {
    cw: AttendanceWeekSlot[];
    wscByMinistry: Record<string, AttendanceWeekSlot[]>;
  };
  groups: AttendanceMonitoringGroup[];
}
