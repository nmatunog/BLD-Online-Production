'use client';

import { useEffect, useState, useMemo, useCallback, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, Calendar, Users, CheckCircle, DollarSign, BarChart3, Loader2, Filter, RefreshCw, X, TrendingUp, Eye, EyeOff, Church, MessageCircle, AlertCircle, ChevronDown, ChevronUp, Search, ZoomIn, LineChart, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { reportsService, ReportType, RecurringReportType, PeriodType, type ReportResult, type AttendanceReport, type RegistrationReport, type MemberReport, type EventReport, type RecurringAttendanceReport, type CommunitySummaryRow, type MonthlyAttendanceTrendPoint } from '@/services/reports.service';
import { eventsService, type Event } from '@/services/events.service';
import { membersService, type Member } from '@/services/members.service';
import { attendanceService, type Attendance } from '@/services/attendance.service';
import { authService } from '@/services/auth.service';
import { APOSTOLATES, MINISTRIES_BY_APOSTOLATE, getMinistriesForApostolate } from '@/lib/member-constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/get-error-message';
import DashboardHeader from '@/components/layout/DashboardHeader';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>(ReportType.ATTENDANCE);
  const [reportData, setReportData] = useState<ReportResult | null>(null);
  const reportResultsRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [showIndividualReports, setShowIndividualReports] = useState(false);
  const [individualReportConfig, setIndividualReportConfig] = useState({
    period: PeriodType.MONTHLY,
    selectedMonth: (new Date().getMonth() + 1).toString(),
    selectedYear: new Date().getFullYear().toString(),
    selectedQuarter: 'Q1',
    startDate: '',
    endDate: '',
  });

  // Analytics dashboard states
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState<{
    totalMembers: number;
    totalEvents: number;
    attendanceRate: number;
    thisMonthEvents: number;
    activeMinistries: number;
  } | null>(null);
  const [recurringEventMetrics, setRecurringEventMetrics] = useState<{
    corporateWorship: { count: number; attendanceRate: number; totalAttendances: number };
    wordSharingCircles: { count: number; attendanceRate: number; totalAttendances: number };
    nonRecurring: { count: number; attendanceRate: number; totalAttendances: number };
  } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [ministryPerformance, setMinistryPerformance] = useState<Array<{ ministry: string; attendanceRate: number }>>([]);
  const [recentTrends, setRecentTrends] = useState<Array<{ category: string; change: number; color: string }>>([]);

  // Recurring attendance report states
  const [showRecurringReport, setShowRecurringReport] = useState(false);
  const [showIndividualReport, setShowIndividualReport] = useState(false);
  const [recurringReportData, setRecurringReportData] = useState<RecurringAttendanceReport | null>(null);
  const [individualReportData, setIndividualReportData] = useState<RecurringAttendanceReport | null>(null);
  /** When user clicks Generate Member Report we store this so the dialog always shows name, Community ID, and period even if API returns empty */
  const [requestedIndividualReport, setRequestedIndividualReport] = useState<{
    communityId: string;
    firstName: string;
    lastName: string;
    middleInitial?: string;
    ministry?: string;
    apostolate?: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [recurringReportConfig, setRecurringReportConfig] = useState({
    reportType: RecurringReportType.COMMUNITY,
    period: PeriodType.MONTHLY,
    startDate: '',
    endDate: '',
    memberId: '',
    ministry: '',
    apostolate: '',
    selectedMonth: '',
    selectedYear: new Date().getFullYear().toString(),
    selectedQuarter: '',
  });
  const [monthlyTrendData, setMonthlyTrendData] = useState<MonthlyAttendanceTrendPoint[] | null>(null);
  const [monthlyTrendLoading, setMonthlyTrendLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    eventId: '',
    memberId: '',
    startDate: '',
    endDate: '',
    encounterType: '',
    ministry: '',
    city: '',
  });

  // Advanced filtering states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    searchTerm: '',
    dateRange: { start: '', end: '' },
    ministries: [] as string[],
    eventTypes: [] as string[],
    attendanceRange: { min: 0, max: 100 },
    sortBy: 'date' as 'date' | 'title' | 'attendance',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);

  useEffect(() => {
    const authData = localStorage.getItem('authData');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        setUserRole(parsed.user?.role || '');
      } catch {
        // ignore
      }
    }
    setDataLoading(true);
    Promise.allSettled([loadEvents(), loadMembers(), loadAttendanceRecords()]).finally(() => {
      setDataLoading(false);
    });

    // Initialize individual report config dates
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0);
    setIndividualReportConfig(prev => ({
      ...prev,
      startDate: monthStart.toISOString().split('T')[0],
      endDate: monthEnd.toISOString().split('T')[0],
    }));
  }, [router]);

  // Load analytics when data is available
  useEffect(() => {
    if (showAnalytics && members.length > 0 && events.length > 0) {
      loadDashboardMetrics();
    }
  }, [showAnalytics, members.length, events.length]);

  const loadEvents = async () => {
    try {
      const result = await eventsService.getAll({ limit: 100 });
      if (result.success && result.data) {
        setEvents(Array.isArray(result.data.data) ? result.data.data : []);
      }
    } catch (error) {
      toast.error('Failed to load events', {
        description: getErrorMessage(error, 'Could not load events for reports.'),
      });
    }
  };

  const loadMembers = async () => {
    try {
      const result = await membersService.getAll({ limit: 1000 });
      if (result && result.data) {
        setMembers(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      toast.error('Failed to load members', {
        description: getErrorMessage(error, 'Could not load members for reports.'),
      });
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      const result = await attendanceService.getAll({ limit: 10000 });
      if (result.success && result.data) {
        setAttendanceRecords(Array.isArray(result.data.data) ? result.data.data : []);
      }
    } catch (error) {
      toast.error('Failed to load attendance data', {
        description: getErrorMessage(error, 'Could not load attendance records.'),
      });
    }
  };

  // Calculate recurring event metrics
  const calculateRecurringEventMetrics = useCallback((attendanceRecords: Attendance[], events: Event[], members: Member[]) => {
    // Categorize events
    const corporateWorshipEvents = events.filter(event => 
      event.title && event.title.toLowerCase().includes('corporate worship')
    );

    const wordSharingEvents = events.filter(event => 
      event.title && (
        event.title.toLowerCase().includes('word sharing') ||
        event.title.toLowerCase().includes('wsc') ||
        event.title.toLowerCase().includes('word sharing circle')
      )
    );

    const nonRecurringEvents = events.filter(event => 
      event.title && 
      !event.title.toLowerCase().includes('corporate worship') && 
      !event.title.toLowerCase().includes('word sharing') &&
      !event.title.toLowerCase().includes('wsc') &&
      !event.title.toLowerCase().includes('word sharing circle')
    );

    // Calculate metrics for each category
    const calculateCategoryMetrics = (categoryEvents: Event[], categoryName: string) => {
      const categoryAttendanceRecords = attendanceRecords.filter(record => 
        categoryEvents.some(event => event.id === record.eventId)
      );

      const totalPossibleAttendances = members.length * categoryEvents.length;
      const actualAttendances = categoryAttendanceRecords.length;
      const attendanceRate = totalPossibleAttendances > 0 
        ? Math.round((actualAttendances / totalPossibleAttendances) * 100)
        : 0;

      return {
        count: categoryEvents.length,
        attendanceRate,
        totalAttendances: actualAttendances,
      };
    };

    return {
      corporateWorship: calculateCategoryMetrics(corporateWorshipEvents, 'Community Worship'),
      wordSharingCircles: calculateCategoryMetrics(wordSharingEvents, 'Word Sharing Circles'),
      nonRecurring: calculateCategoryMetrics(nonRecurringEvents, 'Non-Recurring'),
    };
  }, []);

  // Calculate attendance rate
  const calculateAttendanceRate = useCallback((attendanceRecords: Attendance[], members: Member[], events: Event[]) => {
    if (members.length === 0 || events.length === 0) return 0;
    
    const totalPossibleAttendances = members.length * events.length;
    const actualAttendances = attendanceRecords.length;
    
    return totalPossibleAttendances > 0 
      ? Math.round((actualAttendances / totalPossibleAttendances) * 100)
      : 0;
  }, []);

  // Calculate ministry performance
  const calculateMinistryPerformance = useCallback((attendanceRecords: Attendance[], members: Member[], events: Event[]) => {
    const ministryMap = new Map<string, { totalPossible: number; totalAttended: number }>();
    
    // Get all ministries from members, filtering out null/undefined and ensuring string type
    const ministries = new Set(
      members
        .map(m => m.ministry)
        .filter((m): m is string => typeof m === 'string' && m.length > 0)
    );
    
    ministries.forEach(ministry => {
      const ministryMembers = members.filter(m => m.ministry === ministry);
      let totalPossible = 0;
      let totalAttended = 0;
      
      events.forEach(event => {
        const possible = ministryMembers.length;
        const attended = attendanceRecords.filter(a => 
          a.eventId === event.id && ministryMembers.some(m => m.id === a.memberId)
        ).length;
        
        totalPossible += possible;
        totalAttended += attended;
      });
      
      const attendanceRate = totalPossible > 0 ? (totalAttended / totalPossible) * 100 : 0;
      ministryMap.set(ministry, { totalPossible, totalAttended });
    });
    
    // Convert to array and sort by attendance rate
    const performance = Array.from(ministries).map(ministry => {
      const data = ministryMap.get(ministry) || { totalPossible: 0, totalAttended: 0 };
      const attendanceRate = data.totalPossible > 0 ? (data.totalAttended / data.totalPossible) * 100 : 0;
      return { ministry, attendanceRate };
    }).sort((a, b) => b.attendanceRate - a.attendanceRate);
    
    return performance;
  }, []);

  // Calculate recent trends (simplified - comparing last 30 days vs previous 30 days)
  const calculateRecentTrends = useCallback((attendanceRecords: Attendance[], events: Event[]) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    // Community Worship
    const recentCW = events.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= thirtyDaysAgo && eventDate < now && e.category === 'Community Worship';
    }).length;
    const previousCW = events.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= sixtyDaysAgo && eventDate < thirtyDaysAgo && e.category === 'Community Worship';
    }).length;
    const cwChange = previousCW > 0 ? ((recentCW - previousCW) / previousCW) * 100 : 0;
    
    // Word Sharing Circles
    const recentWSC = events.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= thirtyDaysAgo && eventDate < now && e.category === 'Word Sharing Circles';
    }).length;
    const previousWSC = events.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= sixtyDaysAgo && eventDate < thirtyDaysAgo && e.category === 'Word Sharing Circles';
    }).length;
    const wscChange = previousWSC > 0 ? ((recentWSC - previousWSC) / previousWSC) * 100 : 0;
    
    // Special Events
    const recentSE = events.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= thirtyDaysAgo && eventDate < now && e.eventType === 'Special Event';
    }).length;
    const previousSE = events.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= sixtyDaysAgo && eventDate < thirtyDaysAgo && e.eventType === 'Special Event';
    }).length;
    const seChange = previousSE > 0 ? ((recentSE - previousSE) / previousSE) * 100 : 0;
    
    return [
      { category: 'Community Worship', change: Math.round(cwChange), color: 'green' },
      { category: 'Word Sharing Circles', change: Math.round(wscChange), color: 'purple' },
      { category: 'Special Events', change: Math.round(seChange), color: 'orange' },
    ];
  }, []);

  // Load dashboard metrics
  const loadDashboardMetrics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      // Calculate attendance rate
      const attendanceRate = calculateAttendanceRate(attendanceRecords, members, events);

      // Calculate recurring event metrics
      const recurringMetrics = calculateRecurringEventMetrics(attendanceRecords, events, members);
      setRecurringEventMetrics(recurringMetrics);

      // Calculate ministry performance
      const ministryPerf = calculateMinistryPerformance(attendanceRecords, members, events);
      setMinistryPerformance(ministryPerf);

      // Calculate recent trends
      const trends = calculateRecentTrends(attendanceRecords, events);
      setRecentTrends(trends);

      // Get unique ministries
      const uniqueMinistries = new Set(members.map(m => m.ministry).filter(Boolean));

      // Calculate this month events
      const now = new Date();
      const thisMonthEvents = events.filter(e => {
        const eventDate = new Date(e.startDate);
        return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
      }).length;

      const metrics = {
        totalMembers: members.length,
        totalEvents: events.length,
        attendanceRate,
        thisMonthEvents,
        activeMinistries: uniqueMinistries.size,
      };

      setDashboardMetrics(metrics);
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
      // Fallback metrics
      const uniqueMinistries = new Set(members.map(m => m.ministry).filter(Boolean));
      const now = new Date();
      const thisMonthEvents = events.filter(e => {
        const eventDate = new Date(e.startDate);
        return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
      }).length;

      setDashboardMetrics({
        totalMembers: members.length,
        totalEvents: events.length,
        attendanceRate: 0,
        thisMonthEvents,
        activeMinistries: uniqueMinistries.size,
      });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [attendanceRecords, members, events, calculateAttendanceRate, calculateRecurringEventMetrics, calculateMinistryPerformance, calculateRecentTrends]);

  // Calculate period dates based on period type
  const calculatePeriodDates = useCallback((period: PeriodType, selectedMonth?: string, selectedYear?: string, selectedQuarter?: string) => {
    const currentYear = selectedYear ? parseInt(selectedYear) : new Date().getFullYear();
    const currentMonth = selectedMonth ? parseInt(selectedMonth) - 1 : new Date().getMonth();
    const now = new Date();

    switch (period) {
      case PeriodType.WEEKLY:
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return {
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
        };

      case PeriodType.MONTHLY:
        if (!selectedMonth || !selectedYear) {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
          };
        }
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        return {
          startDate: monthStart.toISOString().split('T')[0],
          endDate: monthEnd.toISOString().split('T')[0],
        };

      case PeriodType.QUARTERLY:
        if (!selectedQuarter || !selectedYear) {
          const quarter = Math.floor(now.getMonth() / 3);
          const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
          const quarterEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
          return {
            startDate: quarterStart.toISOString().split('T')[0],
            endDate: quarterEnd.toISOString().split('T')[0],
          };
        }
        const quarter = selectedQuarter === 'Q1' ? 0 : selectedQuarter === 'Q2' ? 3 : selectedQuarter === 'Q3' ? 6 : 9;
        const qStart = new Date(currentYear, quarter, 1);
        const qEnd = new Date(currentYear, quarter + 3, 0);
        return {
          startDate: qStart.toISOString().split('T')[0],
          endDate: qEnd.toISOString().split('T')[0],
        };

      case PeriodType.YTD:
        const ytdStart = new Date(currentYear, 0, 1);
        const ytdEnd = currentYear < now.getFullYear()
          ? new Date(currentYear, 11, 31)
          : new Date();
        return {
          startDate: ytdStart.toISOString().split('T')[0],
          endDate: ytdEnd.toISOString().split('T')[0],
        };

      case PeriodType.ANNUAL:
        if (!selectedYear) {
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const yearEnd = new Date(now.getFullYear(), 11, 31);
          return {
            startDate: yearStart.toISOString().split('T')[0],
            endDate: yearEnd.toISOString().split('T')[0],
          };
        }
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);
        return {
          startDate: yearStart.toISOString().split('T')[0],
          endDate: yearEnd.toISOString().split('T')[0],
        };

      default:
        return { startDate: '', endDate: '' };
    }
  }, []);

  const handlePeriodChange = (period: PeriodType) => {
    setRecurringReportConfig(prev => {
      const dates = calculatePeriodDates(period, prev.selectedMonth, prev.selectedYear, prev.selectedQuarter);
      return { ...prev, period, startDate: dates.startDate, endDate: dates.endDate };
    });
  };

  const handleMonthChange = (month: string) => {
    setRecurringReportConfig(prev => {
      const dates = calculatePeriodDates(prev.period, month, prev.selectedYear, prev.selectedQuarter);
      return { ...prev, selectedMonth: month, startDate: dates.startDate, endDate: dates.endDate };
    });
  };

  const handleYearChange = (year: string) => {
    setRecurringReportConfig(prev => {
      const dates = calculatePeriodDates(prev.period, prev.selectedMonth, year, prev.selectedQuarter);
      return { ...prev, selectedYear: year, startDate: dates.startDate, endDate: dates.endDate };
    });
  };

  const handleQuarterChange = (quarter: string) => {
    setRecurringReportConfig(prev => {
      const dates = calculatePeriodDates(prev.period, prev.selectedMonth, prev.selectedYear, quarter);
      return { ...prev, selectedQuarter: quarter, startDate: dates.startDate, endDate: dates.endDate };
    });
  };

  // Generate month options
  const monthOptions = useMemo(() => {
    return [
      { value: '1', label: 'January' },
      { value: '2', label: 'February' },
      { value: '3', label: 'March' },
      { value: '4', label: 'April' },
      { value: '5', label: 'May' },
      { value: '6', label: 'June' },
      { value: '7', label: 'July' },
      { value: '8', label: 'August' },
      { value: '9', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ];
  }, []);

  // Generate year options (current year ± 2 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(year => ({
      value: year.toString(),
      label: year.toString(),
    }));
  }, []);

  // Generate quarter options
  const quarterOptions = useMemo(() => {
    return [
      { value: 'Q1', label: 'Q1 (Jan-Mar)' },
      { value: 'Q2', label: 'Q2 (Apr-Jun)' },
      { value: 'Q3', label: 'Q3 (Jul-Sep)' },
      { value: 'Q4', label: 'Q4 (Oct-Dec)' },
    ];
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const params: any = {
        reportType,
        ...filters,
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined) {
          delete params[key];
        }
      });

      const result = await reportsService.generateReport(params);
      setReportData(result.data);
      toast.success('Report Generated', {
        description: 'Report has been generated successfully.',
      });
      // Scroll to report results after a short delay to ensure DOM is updated
      setTimeout(() => {
        reportResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRecurringAttendanceReport = async () => {
    if (!recurringReportConfig.startDate || !recurringReportConfig.endDate) {
      toast.error('Date Range Required', {
        description: 'Please select a period or enter start and end dates.',
      });
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        reportType: ReportType.RECURRING_ATTENDANCE,
        recurringReportType: recurringReportConfig.reportType,
        period: recurringReportConfig.period,
        startDate: recurringReportConfig.startDate,
        endDate: recurringReportConfig.endDate,
      };

      if (recurringReportConfig.reportType === RecurringReportType.INDIVIDUAL && recurringReportConfig.memberId) {
        params.memberId = recurringReportConfig.memberId;
      }
      if (recurringReportConfig.reportType === RecurringReportType.MINISTRY && recurringReportConfig.ministry) {
        params.ministry = recurringReportConfig.ministry;
      }
      if (recurringReportConfig.reportType === RecurringReportType.COMMUNITY && recurringReportConfig.apostolate) {
        params.apostolate = recurringReportConfig.apostolate;
      }

      const result = await reportsService.generateReport(params);
      setRecurringReportData(result.data as RecurringAttendanceReport);
      setShowRecurringReport(true);

      // Fetch monthly attendance trend for Ministry report (CW % & WSC % per month)
      if (recurringReportConfig.reportType === RecurringReportType.MINISTRY && recurringReportConfig.ministry) {
        setMonthlyTrendData(null);
        setMonthlyTrendLoading(true);
        const year = recurringReportConfig.selectedYear
          ? parseInt(recurringReportConfig.selectedYear, 10)
          : new Date().getFullYear();
        reportsService
          .getMonthlyAttendanceTrend(recurringReportConfig.ministry, year)
          .then((trend) => setMonthlyTrendData(trend))
          .catch(() => setMonthlyTrendData([]))
          .finally(() => setMonthlyTrendLoading(false));
      } else {
        setMonthlyTrendData(null);
      }

      toast.success('Recurring Attendance Report Generated', {
        description: 'Report has been generated successfully.',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) {
      toast.error('No Report Data', {
        description: 'Please generate a report first.',
      });
      return;
    }

    const data = (reportData as any).data || [];
    if (data.length === 0) {
      toast.error('No Data to Export', {
        description: 'The report contains no data.',
      });
      return;
    }

    const filename = `${reportType.toLowerCase()}-report-${new Date().toISOString().split('T')[0]}`;
    reportsService.exportToCSV(data, filename);
    toast.success('Report Exported', {
      description: 'Report has been exported to CSV.',
    });
  };

  const exportRecurringReportToCSV = () => {
    if (!recurringReportData) return;

    const data = recurringReportData.data || [];
    if (data.length === 0) {
      toast.error('No Data to Export');
      return;
    }

    const filename = `recurring-attendance-report-${new Date().toISOString().split('T')[0]}`;
    reportsService.exportToCSV(data, filename);
    toast.success('Report Exported to CSV');
  };

  const exportRecurringReportToPDF = () => {
    if (!recurringReportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Helper function to add text with word wrapping
    const addText = (text: string, x: number, y: number, options: { fontSize?: number; fontStyle?: string; color?: [number, number, number]; maxWidth?: number } = {}) => {
      const { fontSize = 12, fontStyle = 'normal', color = [0, 0, 0], maxWidth = pageWidth - 40 } = options;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle as any);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + (lines.length * fontSize * 0.4);
    };

    // Report Header
    yPosition = addText('BLD Cebu Community Online Portal - Attendance Report', 20, yPosition, { fontSize: 20, fontStyle: 'bold', color: [0, 0, 139] });
    yPosition += 5;
    
    const isCommunity = recurringReportConfig.reportType === RecurringReportType.COMMUNITY;
    yPosition = addText(
      isCommunity ? 'Community Report – by Apostolate & Ministry' : `${recurringReportConfig.ministry || 'All Ministries'} - ${recurringReportConfig.apostolate || 'All Apostolates'}`,
      20,
      yPosition,
      { fontSize: 14, color: [0, 0, 139] }
    );
    const periodText = `${recurringReportConfig.startDate} to ${recurringReportConfig.endDate}`;
    yPosition = addText(`Period: ${periodText}`, 20, yPosition, { fontSize: 12, color: [100, 100, 100] });
    yPosition += 10;

    const summary = recurringReportData.statistics;
    yPosition = addText('Summary Statistics', 20, yPosition, { fontSize: 16, fontStyle: 'bold' });
    yPosition += 10;

    const summaryData = isCommunity
      ? [
          ['Total Ministries', (summary?.totalMinistries ?? 0).toString()],
          ['Total Members', (summary?.totalMembers ?? 0).toString()],
          ['CW % (vs 100%)', `${summary?.communityCwPercentage ?? 0}%`],
          ['WSC % (vs 100%)', `${summary?.communityWscPercentage ?? 0}%`],
          ['Avg CW % by Ministry', `${summary?.averageCwPercentageByMinistry ?? 0}%`],
          ['Avg WSC % by Ministry', `${summary?.averageWscPercentageByMinistry ?? 0}%`],
        ]
      : [
          ['Total Members', (summary?.totalMembers ?? 0).toString()],
          ['Average Attendance', `${summary?.averageAttendance ?? 0}%`],
          ['Community Worship Instances', (summary?.totalInstances?.corporateWorship ?? 0).toString()],
          ['Word Sharing Circles Instances', (summary?.totalInstances?.wordSharingCircles ?? 0).toString()],
        ];

    summaryData.forEach(([label, value]) => {
      yPosition = addText(`${label}:`, 20, yPosition, { fontSize: 12, fontStyle: 'bold' });
      yPosition = addText(value, 80, yPosition, { fontSize: 12 });
      yPosition += 5;
    });
    yPosition += 10;

    if (recurringReportData.data.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      if (isCommunity && recurringReportData.data[0] && 'totalMembers' in recurringReportData.data[0]) {
        yPosition = addText('Attendance by Apostolate & Ministry', 20, yPosition, { fontSize: 16, fontStyle: 'bold' });
        yPosition += 10;
        const headers = ['Apostolate', 'Ministry', 'Members', 'CW Att.', 'CW %', 'WSC Att.', 'WSC %'];
        const colWidths = [38, 38, 14, 14, 12, 14, 12];
        let xPos = 20;
        headers.forEach((header, index) => {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(header, xPos, yPosition);
          xPos += colWidths[index];
        });
        yPosition += 8;
        (recurringReportData.data as CommunitySummaryRow[]).forEach((row) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          xPos = 20;
          const rowData = [
            String(row.apostolate).slice(0, 22),
            String(row.ministry).slice(0, 22),
            row.totalMembers.toString(),
            row.totalCwAttended.toString(),
            `${row.cwPercentage}%`,
            row.totalWscAttended.toString(),
            `${row.wscPercentage}%`,
          ];
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          rowData.forEach((cell, cellIndex) => {
            doc.text(cell, xPos, yPosition);
            xPos += colWidths[cellIndex];
          });
          yPosition += 6;
        });
      } else {
        yPosition = addText('Member Attendance', 20, yPosition, { fontSize: 16, fontStyle: 'bold' });
        yPosition += 10;
        const headers = ['Name', 'Community ID', 'CW present', 'Total CW', 'CW %', 'WSC present', 'Total WSC', 'WSC %'];
        const colWidths = [45, 22, 14, 12, 12, 14, 12, 12];
        let xPos = 20;
        headers.forEach((header, index) => {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(header, xPos, yPosition);
          xPos += colWidths[index];
        });
        yPosition += 8;
        recurringReportData.data.forEach((member: any) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          const name = [member.lastName, member.firstName].filter(Boolean).join(', ') +
            (member.middleInitial ? ` ${member.middleInitial}.` : (member.middleName ? ` ${member.middleName.charAt(0).toUpperCase()}.` : ''));
          xPos = 20;
          const rowData = [
            name,
            member.communityId || '',
            (member.corporateWorshipAttended ?? 0).toString(),
            (member.totalCwInPeriod ?? summary?.totalInstances?.corporateWorship ?? '-').toString(),
            `${member.corporateWorshipPercentage ?? 0}%`,
            (member.wordSharingCirclesAttended ?? 0).toString(),
            (member.totalWscInPeriod ?? summary?.totalInstances?.wordSharingCircles ?? '-').toString(),
            `${member.wordSharingCirclesPercentage ?? 0}%`,
          ];
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          rowData.forEach((cell, cellIndex) => {
            doc.text(String(cell).slice(0, 25), xPos, yPosition);
            xPos += colWidths[cellIndex];
          });
          yPosition += 6;
        });
      }
    }

    // Save PDF
    const filename = `recurring-attendance-report-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    toast.success('Report Exported to PDF');
  };

  // Monthly attendance trend chart (Ministry report only): CW % and WSC % per month
  const monthlyTrendChartData = useMemo(() => {
    if (!monthlyTrendData || monthlyTrendData.length === 0) return null;
    return {
      labels: monthlyTrendData.map((d) => d.monthLabel),
      datasets: [
        {
          label: 'CW %',
          data: monthlyTrendData.map((d) => d.cwPercentage),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
        {
          label: 'WSC %',
          data: monthlyTrendData.map((d) => d.wscPercentage),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
        },
      ],
    };
  }, [monthlyTrendData]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const allowedRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR'];
  const canAccess = allowedRoles.includes(userRole);

  if (!canAccess && userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Access Denied</h2>
            <p className="text-lg text-gray-600 mb-4">
              You don't have permission to access Reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use official BLD Cebu organization structure from constants
  // This ensures consistency across the system
  const apostolates = useMemo(() => {
    return Array.from(APOSTOLATES);
  }, []);

  // Get all ministries from the official structure
  const allMinistries = useMemo(() => {
    const all: string[] = [];
    Object.values(MINISTRIES_BY_APOSTOLATE).forEach(ministries => {
      all.push(...ministries);
    });
    return all.sort();
  }, []);

  // Get ministries from actual member data (for backward compatibility)
  const memberMinistries = useMemo(() => {
    const unique = new Set(
      members
        .map(m => m.ministry)
        .filter((m): m is string => typeof m === 'string' && m.length > 0)
    );
    return Array.from(unique).sort();
  }, [members]);

  // Use official structure, but also include any ministries from member data that might not be in constants
  const ministries = useMemo(() => {
    const official = new Set(allMinistries);
    memberMinistries.forEach(m => official.add(m));
    return Array.from(official).sort();
  }, [allMinistries, memberMinistries]);

  // Use official MINISTRIES_BY_APOSTOLATE structure
  const ministriesByApostolate = useMemo(() => {
    return MINISTRIES_BY_APOSTOLATE;
  }, []);

  // Get ministries filtered by selected apostolate using official structure
  const getFilteredMinistries = useCallback((selectedApostolate?: string | null) => {
    if (!selectedApostolate || selectedApostolate === 'ALL' || selectedApostolate === '') {
      return ministries;
    }
    return getMinistriesForApostolate(selectedApostolate) || [];
  }, [ministries]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {dataLoading && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-800">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <span className="text-sm font-medium">Loading report data…</span>
            </div>
          )}
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600 mt-1">Generate and export reports</p>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
              <Button 
                onClick={() => setShowAnalytics(!showAnalytics)} 
                variant={showAnalytics ? "default" : "outline"}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {showAnalytics ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Analytics
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show Analytics
                  </>
                )}
              </Button>
              {reportData && (
                <Button onClick={exportToCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
              )}
            </div>
          </div>

          {/* Analytics Dashboard */}
          {showAnalytics && (
            <div className="space-y-6">
              {/* Analytics Dashboard Section */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <BarChart3 className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-purple-800 text-2xl font-bold">Attendance Reports</CardTitle>
                        <p className="text-purple-600 mt-1 text-sm">
                          Visual analytics and insights for attendance patterns, ministry performance, and member engagement trends.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={loadDashboardMetrics}
                      disabled={analyticsLoading}
                      variant="outline"
                      className="bg-white hover:bg-purple-50 border-purple-200 shadow-sm"
                    >
                      {analyticsLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh Data
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                  ) : dashboardMetrics ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Total Members */}
                      <Card className="bg-white border-purple-200">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Total Members</p>
                              <p className="text-3xl font-bold text-purple-600">{dashboardMetrics.totalMembers}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-full">
                              <Users className="w-6 h-6 text-purple-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Total Events */}
                      <Card className="bg-white border-purple-200">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Total Events</p>
                              <p className="text-3xl font-bold text-purple-600">{dashboardMetrics.totalEvents}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-full">
                              <Calendar className="w-6 h-6 text-purple-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Attendance Rate */}
                      <Card className="bg-white border-green-200">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Attendance Rate</p>
                              <p className="text-3xl font-bold text-green-600">{dashboardMetrics.attendanceRate}%</p>
                              <p className="text-xs text-gray-500 mt-1">Based on actual check-ins vs possible attendances</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                              <TrendingUp className="w-6 h-6 text-green-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* This Month Events */}
                      <Card className="bg-white border-orange-200">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">This Month Events</p>
                              <p className="text-3xl font-bold text-orange-600">{dashboardMetrics.thisMonthEvents}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-full">
                              <Calendar className="w-6 h-6 text-orange-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p>Click "Refresh Data" to load analytics</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ministry Performance & Recent Trends */}
              {dashboardMetrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Ministry Performance */}
                  <Card className="bg-white border-purple-200 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Clock className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold text-gray-800">Ministry Performance</CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            Track attendance across different ministries to identify strengths and areas for improvement.
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {ministryPerformance.length > 0 ? (
                          ministryPerformance.slice(0, 5).map((item, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{item.ministry}</span>
                                <span className="text-sm font-semibold text-gray-900">{Math.round(item.attendanceRate)}%</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-600 transition-all duration-500 rounded-full"
                                  style={{ width: `${Math.min(item.attendanceRate, 100)}%` }}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-400">
                            <Users className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No ministry data available</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Trends */}
                  <Card className="bg-white border-purple-200 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <LineChart className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold text-gray-800">Recent Trends</CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            Monitor attendance trends over the past 30 days to spot patterns and opportunities.
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {recentTrends.length > 0 ? (
                          recentTrends.map((trend, index) => {
                            const isPositive = trend.change >= 0;
                            const colorClass = trend.color === 'green' ? 'bg-green-500' : 
                                             trend.color === 'purple' ? 'bg-purple-500' : 'bg-orange-500';
                            const progressWidth = Math.min(Math.abs(trend.change), 100);
                            
                            return (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700">{trend.category}</span>
                                  <div className="flex items-center gap-1">
                                    {isPositive ? (
                                      <ArrowUp className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <ArrowDown className="w-4 h-4 text-red-600" />
                                    )}
                                    <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                      {isPositive ? '+' : ''}{trend.change}%
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${colorClass} transition-all duration-500 rounded-full`}
                                    style={{ width: `${progressWidth}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-gray-400">
                            <LineChart className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No trend data available</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Recurring Event Analytics */}
              {recurringEventMetrics && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-800 text-xl">Recurring Event Analytics</CardTitle>
                    <p className="text-blue-600 text-sm mt-1">
                      Track attendance performance for recurring events to identify patterns and engagement levels.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Community Worship */}
                      <Card className="bg-white border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-purple-100 rounded-lg">
                              <Church className="w-6 h-6 text-purple-600" />
                            </div>
                            <h4 className="font-semibold text-purple-800 text-lg">Community Worship</h4>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Events:</span>
                              <span className="font-bold text-lg text-purple-600">{recurringEventMetrics.corporateWorship.count}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Attendance Rate:</span>
                              <span className="font-bold text-lg text-green-600">{Math.round(recurringEventMetrics.corporateWorship.attendanceRate)}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Total Attendances:</span>
                              <span className="font-bold text-lg text-purple-600">{recurringEventMetrics.corporateWorship.totalAttendances}</span>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-700 rounded-full"
                                  style={{ width: `${Math.min(recurringEventMetrics.corporateWorship.attendanceRate, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Word Sharing Circles */}
                      <Card className="bg-white border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                              <MessageCircle className="w-6 h-6 text-blue-600" />
                            </div>
                            <h4 className="font-semibold text-blue-800 text-lg">Word Sharing Circles</h4>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Events:</span>
                              <span className="font-bold text-lg text-blue-600">{recurringEventMetrics.wordSharingCircles.count}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Attendance Rate:</span>
                              <span className="font-bold text-lg text-green-600">{Math.round(recurringEventMetrics.wordSharingCircles.attendanceRate)}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Total Attendances:</span>
                              <span className="font-bold text-lg text-blue-600">{recurringEventMetrics.wordSharingCircles.totalAttendances}</span>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700 rounded-full"
                                  style={{ width: `${Math.min(recurringEventMetrics.wordSharingCircles.attendanceRate, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Non-Recurring Events */}
                      <Card className="bg-white border-gray-200">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gray-100 rounded-full">
                              <Calendar className="w-6 h-6 text-gray-600" />
                            </div>
                            <h4 className="font-semibold text-gray-800">Non-Recurring Events</h4>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Events:</span>
                              <span className="font-semibold text-gray-600">{recurringEventMetrics.nonRecurring.count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Attendance Rate:</span>
                              <span className="font-semibold text-gray-600">{recurringEventMetrics.nonRecurring.attendanceRate}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Attendances:</span>
                              <span className="font-semibold text-gray-600">{recurringEventMetrics.nonRecurring.totalAttendances}</span>
                            </div>
                            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gray-400 transition-all duration-500"
                                style={{ width: `${Math.min(recurringEventMetrics.nonRecurring.attendanceRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Recurring Attendance Reports Section */}
          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-purple-800 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6" />
                    Recurring Attendance Reports
                  </CardTitle>
                  <p className="text-sm text-purple-600 mt-2">
                    Generate comprehensive attendance reports for Community Worship and Word Sharing Circles with multiple report types and periods.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Report Configuration */}
                <Card className="bg-white border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Report Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Report Type */}
                    <div>
                      <Label htmlFor="recurringReportType">Report Type</Label>
                      <Select
                        value={recurringReportConfig.reportType}
                        onValueChange={(value) => setRecurringReportConfig({ ...recurringReportConfig, reportType: value as RecurringReportType })}
                      >
                        <SelectTrigger id="recurringReportType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={RecurringReportType.INDIVIDUAL}>Individual Member</SelectItem>
                          <SelectItem value={RecurringReportType.MINISTRY}>Ministry Report</SelectItem>
                          <SelectItem value={RecurringReportType.COMMUNITY}>Community Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Period */}
                    <div>
                      <Label htmlFor="period">Period</Label>
                      <Select
                        value={recurringReportConfig.period}
                        onValueChange={handlePeriodChange}
                      >
                        <SelectTrigger id="period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PeriodType.WEEKLY}>Weekly</SelectItem>
                          <SelectItem value={PeriodType.MONTHLY}>Monthly</SelectItem>
                          <SelectItem value={PeriodType.QUARTERLY}>Quarterly</SelectItem>
                          <SelectItem value={PeriodType.YTD}>Year to Date</SelectItem>
                          <SelectItem value={PeriodType.ANNUAL}>Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Month Selection (for Monthly) */}
                    {recurringReportConfig.period === PeriodType.MONTHLY && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="month">Month</Label>
                          <Select
                            value={recurringReportConfig.selectedMonth}
                            onValueChange={handleMonthChange}
                          >
                            <SelectTrigger id="month">
                              <SelectValue placeholder="Select Month" />
                            </SelectTrigger>
                            <SelectContent>
                              {monthOptions.map((month) => (
                                <SelectItem key={month.value} value={month.value}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="year">Year</Label>
                          <Select
                            value={recurringReportConfig.selectedYear}
                            onValueChange={handleYearChange}
                          >
                            <SelectTrigger id="year">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {yearOptions.map((year) => (
                                <SelectItem key={year.value} value={year.value}>
                                  {year.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Quarter Selection (for Quarterly) */}
                    {recurringReportConfig.period === PeriodType.QUARTERLY && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="quarter">Quarter</Label>
                          <Select
                            value={recurringReportConfig.selectedQuarter}
                            onValueChange={handleQuarterChange}
                          >
                            <SelectTrigger id="quarter">
                              <SelectValue placeholder="Select Quarter" />
                            </SelectTrigger>
                            <SelectContent>
                              {quarterOptions.map((quarter) => (
                                <SelectItem key={quarter.value} value={quarter.value}>
                                  {quarter.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="year">Year</Label>
                          <Select
                            value={recurringReportConfig.selectedYear}
                            onValueChange={handleYearChange}
                          >
                            <SelectTrigger id="year">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {yearOptions.map((year) => (
                                <SelectItem key={year.value} value={year.value}>
                                  {year.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Year Selection (for YTD) */}
                    {recurringReportConfig.period === PeriodType.YTD && (
                      <div>
                        <Label htmlFor="yearYtd">Year (Jan 1 – today)</Label>
                        <Select
                          value={recurringReportConfig.selectedYear}
                          onValueChange={handleYearChange}
                        >
                          <SelectTrigger id="yearYtd">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((year) => (
                              <SelectItem key={year.value} value={year.value}>
                                {year.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Year Selection (for Annual) */}
                    {recurringReportConfig.period === PeriodType.ANNUAL && (
                      <div>
                        <Label htmlFor="year">Year</Label>
                        <Select
                          value={recurringReportConfig.selectedYear}
                          onValueChange={handleYearChange}
                        >
                          <SelectTrigger id="year">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((year) => (
                              <SelectItem key={year.value} value={year.value}>
                                {year.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Individual Member Selection */}
                    {recurringReportConfig.reportType === RecurringReportType.INDIVIDUAL && (
                      <div>
                        <Label htmlFor="memberId">Select Member</Label>
                        <Select
                          value={recurringReportConfig.memberId}
                          onValueChange={(value) => setRecurringReportConfig({ ...recurringReportConfig, memberId: value })}
                        >
                          <SelectTrigger id="memberId">
                            <SelectValue placeholder="Select a member..." />
                          </SelectTrigger>
                          <SelectContent>
                            {members.length > 0 ? (
                              members.map((member) => {
                                const middleInitial = member.middleName ? member.middleName.charAt(0).toUpperCase() : '';
                                return (
                                  <SelectItem key={member.id} value={member.communityId}>
                                    {member.lastName}, {member.firstName} {middleInitial} ({member.communityId})
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <SelectItem value="NO_DATA" disabled>
                                No members available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Ministry Selection */}
                    {recurringReportConfig.reportType === RecurringReportType.MINISTRY && (
                      <>
                        {/* Apostolate Selection for filtering ministries */}
                        <div>
                          <Label htmlFor="ministryApostolateFilter">Filter by Apostolate (Optional)</Label>
                          <Select
                            value={recurringReportConfig.apostolate || 'ALL'}
                            onValueChange={(value) => {
                              const apostolate = value === 'ALL' ? '' : value;
                              setRecurringReportConfig({ 
                                ...recurringReportConfig, 
                                apostolate,
                                ministry: '', // Reset ministry when apostolate changes
                              });
                            }}
                          >
                            <SelectTrigger id="ministryApostolateFilter">
                              <SelectValue placeholder="All Apostolates" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">All Apostolates</SelectItem>
                              {APOSTOLATES.map((apostolate) => (
                                <SelectItem key={apostolate} value={apostolate}>
                                  {apostolate}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="ministrySelect">Select Ministry</Label>
                          <Select
                            value={recurringReportConfig.ministry}
                            onValueChange={(value) => setRecurringReportConfig({ ...recurringReportConfig, ministry: value })}
                          >
                            <SelectTrigger id="ministrySelect">
                              <SelectValue placeholder="Select a ministry..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const filteredMinistries = getFilteredMinistries(recurringReportConfig.apostolate);
                                return filteredMinistries.length > 0 ? (
                                  filteredMinistries.map((ministry) => (
                                    <SelectItem key={ministry} value={ministry}>
                                      {ministry}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="NO_DATA" disabled>
                                    {recurringReportConfig.apostolate 
                                      ? `No ministries available for ${recurringReportConfig.apostolate}`
                                      : 'No ministries available'}
                                  </SelectItem>
                                );
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Apostolate Selection */}
                    {recurringReportConfig.reportType === RecurringReportType.COMMUNITY && (
                      <div>
                        <Label htmlFor="apostolate">Select Apostolate (Optional)</Label>
                        <Select
                          value={recurringReportConfig.apostolate || 'ALL'}
                          onValueChange={(value) => setRecurringReportConfig({ ...recurringReportConfig, apostolate: value === 'ALL' ? '' : value })}
                        >
                          <SelectTrigger id="apostolate">
                            <SelectValue placeholder="All Apostolates" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Apostolates</SelectItem>
                            {apostolates.length > 0 ? (
                              apostolates.map((apostolate) => (
                                <SelectItem key={apostolate} value={apostolate}>
                                  {apostolate}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="NO_DATA" disabled>
                                No apostolates available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button onClick={generateRecurringAttendanceReport} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Generate Recurring Report
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Report Features */}
                <Card className="bg-white border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Report Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-green-800 mb-1">Comprehensive Analytics</h5>
                          <p className="text-sm text-green-600">Track attendance for Community Worship and Word Sharing Circles with percentage calculations.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-purple-800 mb-1">Multiple Periods</h5>
                          <p className="text-sm text-purple-600">Generate reports for monthly, quarterly, year-to-date, or annual periods.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-blue-800 mb-1">Flexible Grouping</h5>
                          <p className="text-sm text-blue-600">Individual member cards, ministry reports, or community-wide analysis.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <div className="flex items-start gap-3">
                        <BarChart3 className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-orange-800 mb-1">Smart Sorting</h5>
                          <p className="text-sm text-orange-600">PLSG, Service, and Intercessory sorted by ME Class No., others alphabetically.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Individual Member Reports Section */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <Users className="w-6 h-6" />
                    Individual Member Reports
                  </CardTitle>
                  <p className="text-sm text-green-600 mt-2">
                    Generate detailed attendance reports for specific members across all events or a specific time period.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowIndividualReports(!showIndividualReports)}
                  className="text-green-700 hover:text-green-800 hover:bg-green-100"
                >
                  {showIndividualReports ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {showIndividualReports && (
              <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generate Member Report */}
                <Card className="bg-white border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Generate Member Report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="individualMemberId">Select Member</Label>
                      <Select
                        value={filters.memberId || ''}
                        onValueChange={(value) => {
                          setFilters({ ...filters, memberId: value });
                        }}
                      >
                        <SelectTrigger id="individualMemberId">
                          <SelectValue placeholder="Select a member..." />
                        </SelectTrigger>
                        <SelectContent>
                          {members.length > 0 ? (
                            members.map((member) => {
                              const middleInitial = member.middleName ? member.middleName.charAt(0).toUpperCase() : '';
                              return (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.lastName}, {member.firstName} {middleInitial} ({member.communityId})
                                </SelectItem>
                              );
                            })
                          ) : (
                            <SelectItem value="NO_DATA" disabled>
                              No members available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="individualPeriod">Time Period</Label>
                      <Select
                        value={individualReportConfig.period}
                        onValueChange={(period) => {
                          let dates;
                          if (period === PeriodType.YTD) {
                            // YTD: January 1 of current year to today
                            dates = calculatePeriodDates(PeriodType.YTD, '', new Date().getFullYear().toString(), '');
                          } else if (period === PeriodType.MONTHLY) {
                            // Monthly: Use current month/year if not set
                            dates = calculatePeriodDates(
                              PeriodType.MONTHLY,
                              individualReportConfig.selectedMonth || (new Date().getMonth() + 1).toString(),
                              individualReportConfig.selectedYear || new Date().getFullYear().toString(),
                              ''
                            );
                          } else {
                            // Quarterly: Use Q1 and current year if not set
                            dates = calculatePeriodDates(
                              PeriodType.QUARTERLY,
                              '',
                              individualReportConfig.selectedYear || new Date().getFullYear().toString(),
                              individualReportConfig.selectedQuarter || 'Q1'
                            );
                          }
                          setIndividualReportConfig(prev => ({
                            ...prev,
                            period: period as PeriodType,
                            startDate: dates.startDate,
                            endDate: dates.endDate,
                          }));
                          setFilters({
                            ...filters,
                            startDate: dates.startDate,
                            endDate: dates.endDate,
                          });
                        }}
                      >
                        <SelectTrigger id="individualPeriod">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PeriodType.MONTHLY}>Monthly</SelectItem>
                          <SelectItem value={PeriodType.QUARTERLY}>Quarterly</SelectItem>
                          <SelectItem value={PeriodType.YTD}>Year to Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Month + Year Selection (for Monthly) */}
                    {individualReportConfig.period === PeriodType.MONTHLY && (
                      <>
                        <div>
                          <Label htmlFor="individualMonth">Month</Label>
                          <Select
                            value={individualReportConfig.selectedMonth}
                            onValueChange={(month) => {
                              const dates = calculatePeriodDates(
                                PeriodType.MONTHLY,
                                month,
                                individualReportConfig.selectedYear,
                                ''
                              );
                              setIndividualReportConfig(prev => ({
                                ...prev,
                                selectedMonth: month,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              }));
                              setFilters({
                                ...filters,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              });
                            }}
                          >
                            <SelectTrigger id="individualMonth">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {monthOptions.map((month) => (
                                <SelectItem key={month.value} value={month.value}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="individualYear">Year</Label>
                          <Select
                            value={individualReportConfig.selectedYear}
                            onValueChange={(year) => {
                              const dates = calculatePeriodDates(
                                PeriodType.MONTHLY,
                                individualReportConfig.selectedMonth,
                                year,
                                ''
                              );
                              setIndividualReportConfig(prev => ({
                                ...prev,
                                selectedYear: year,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              }));
                              setFilters({
                                ...filters,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              });
                            }}
                          >
                            <SelectTrigger id="individualYear">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {yearOptions.map((year) => (
                                <SelectItem key={year.value} value={year.value}>
                                  {year.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Quarter + Year Selection (for Quarterly) */}
                    {individualReportConfig.period === PeriodType.QUARTERLY && (
                      <>
                        <div>
                          <Label htmlFor="individualQuarter">Quarter</Label>
                          <Select
                            value={individualReportConfig.selectedQuarter}
                            onValueChange={(quarter) => {
                              const dates = calculatePeriodDates(
                                PeriodType.QUARTERLY,
                                '',
                                individualReportConfig.selectedYear,
                                quarter
                              );
                              setIndividualReportConfig(prev => ({
                                ...prev,
                                selectedQuarter: quarter,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              }));
                              setFilters({
                                ...filters,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              });
                            }}
                          >
                            <SelectTrigger id="individualQuarter">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {quarterOptions.map((quarter) => (
                                <SelectItem key={quarter.value} value={quarter.value}>
                                  {quarter.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="individualQuarterYear">Year</Label>
                          <Select
                            value={individualReportConfig.selectedYear}
                            onValueChange={(year) => {
                              const dates = calculatePeriodDates(
                                PeriodType.QUARTERLY,
                                '',
                                year,
                                individualReportConfig.selectedQuarter
                              );
                              setIndividualReportConfig(prev => ({
                                ...prev,
                                selectedYear: year,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              }));
                              setFilters({
                                ...filters,
                                startDate: dates.startDate,
                                endDate: dates.endDate,
                              });
                            }}
                          >
                            <SelectTrigger id="individualQuarterYear">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {yearOptions.map((year) => (
                                <SelectItem key={year.value} value={year.value}>
                                  {year.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Year to Date - Auto-calculated from January 1 to today */}
                    {individualReportConfig.period === PeriodType.YTD && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                          <strong>Period:</strong> January 1, {new Date().getFullYear()} to {formatDate(new Date().toISOString().split('T')[0])}
                        </p>
                      </div>
                    )}

                    <Button 
                      onClick={async () => {
                        if (!filters.memberId) return;
                        
                        // Find member by ID to get communityId
                        const member = members.find(m => m.id === filters.memberId);
                        if (!member) {
                          toast.error('Member not found');
                          return;
                        }

                        // Calculate period dates based on selected period
                        const dates = calculatePeriodDates(
                          individualReportConfig.period,
                          individualReportConfig.selectedMonth,
                          individualReportConfig.selectedYear,
                          individualReportConfig.selectedQuarter
                        );
                        const startDate = dates.startDate;
                        const endDate = dates.endDate;

                        setLoading(true);
                        try {
                          const params: any = {
                            reportType: ReportType.RECURRING_ATTENDANCE,
                            recurringReportType: RecurringReportType.INDIVIDUAL,
                            period: individualReportConfig.period,
                            startDate,
                            endDate,
                            memberId: member.communityId,
                          };

                          const result = await reportsService.generateReport(params);
                          setIndividualReportData(result.data as RecurringAttendanceReport);
                          setRequestedIndividualReport({
                            communityId: member.communityId,
                            firstName: member.firstName,
                            lastName: member.lastName,
                            middleInitial: member.middleName ? member.middleName.charAt(0).toUpperCase() : undefined,
                            ministry: member.ministry ?? undefined,
                            apostolate: member.apostolate ?? undefined,
                            startDate,
                            endDate,
                          });
                          setRecurringReportConfig(prev => ({
                            ...prev,
                            reportType: RecurringReportType.INDIVIDUAL,
                            memberId: member.communityId,
                            period: individualReportConfig.period,
                            startDate,
                            endDate,
                          }));
                          setShowIndividualReport(true);
                          toast.success('Individual Attendance Report Generated', {
                            description: 'Report has been generated successfully.',
                          });
                        } catch (error: unknown) {
                          const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
                          toast.error('Error', {
                            description: errorMessage,
                          });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !filters.memberId}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Generate Member Report
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Member Report Features */}
                <Card className="bg-white border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Member Report Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-green-800 mb-1">Attendance History</h5>
                          <p className="text-sm text-green-600">Complete attendance record for the selected time period</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-start gap-3">
                        <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-purple-800 mb-1">Performance Metrics</h5>
                          <p className="text-sm text-purple-600">Attendance percentage and participation statistics</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-purple-800 mb-1">Event Breakdown</h5>
                          <p className="text-sm text-purple-600">Detailed breakdown by event type and date</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              </CardContent>
            )}
          </Card>

          {/* Event-Specific Reports Section */}
          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-800 flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Event-Specific Reports
              </CardTitle>
              <p className="text-sm text-purple-600 mt-2">
                Generate detailed reports for individual events showing who attended, when they checked in, and event performance metrics.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generate Event Report */}
                <Card className="bg-white border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Generate Event Report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="eventReportEventId">Select Event</Label>
                      <Select
                        value={filters.eventId || 'ALL'}
                        onValueChange={(value) => {
                          setFilters({ ...filters, eventId: value === 'ALL' ? '' : value });
                          setReportType(ReportType.ATTENDANCE);
                        }}
                      >
                        <SelectTrigger id="eventReportEventId">
                          <SelectValue placeholder="Select an event..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Events</SelectItem>
                          {events.length > 0 ? (
                            events.map((event) => (
                              <SelectItem key={event.id} value={event.id}>
                                {event.title} - {formatDate(event.startDate)}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="NO_DATA" disabled>
                              No events available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="reportFormat">Report Format</Label>
                      <Select
                        value="json"
                        onValueChange={() => {}}
                      >
                        <SelectTrigger id="reportFormat">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">JSON (Data Export)</SelectItem>
                          <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                          <SelectItem value="excel">Excel (Formatted)</SelectItem>
                          <SelectItem value="pdf">PDF (Printable)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      onClick={() => {
                        setReportType(ReportType.ATTENDANCE);
                        generateReport();
                      }}
                      disabled={loading || !filters.eventId}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Generate Event Report
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* What You'll Get */}
                <Card className="bg-white border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-lg">What You'll Get</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-green-800 mb-1">Attendance List</h5>
                          <p className="text-sm text-green-600">Complete list of all members who attended the event with check-in times</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-start gap-3">
                        <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-purple-800 mb-1">Event Statistics</h5>
                          <p className="text-sm text-purple-600">Total attendees, check-in patterns, and attendance rates</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <h5 className="font-semibold text-purple-800 mb-1">Member Details</h5>
                          <p className="text-sm text-purple-600">Contact information and member profiles for follow-up</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Filtering & Search Section */}
          <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <Filter className="w-6 h-6" />
                    Advanced Filtering & Search
                  </CardTitle>
                  <p className="text-sm text-green-600 mt-2">
                    Use advanced filters to find specific events, members, or attendance patterns. Filter by date range, ministry, event type, and more.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    variant="outline"
                    className="bg-white hover:bg-green-50"
                  >
                    {showAdvancedFilters ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Hide Filters
                      </>
                    ) : (
                      <>
                        <Filter className="w-4 h-4 mr-2" />
                        Show Filters
                      </>
                    )}
                  </Button>
                  {showAdvancedFilters && (
                    <>
                      <Button
                        onClick={() => {
                          // Apply filters logic here
                          toast.success('Filters Applied', {
                            description: 'Filters have been applied successfully.',
                          });
                        }}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        Apply Filters
                      </Button>
                      <Button
                        onClick={() => {
                          setAdvancedFilters({
                            searchTerm: '',
                            dateRange: { start: '', end: '' },
                            ministries: [],
                            eventTypes: [],
                            attendanceRange: { min: 0, max: 100 },
                            sortBy: 'date',
                            sortOrder: 'desc',
                          });
                          setFilteredEvents([]);
                          toast.success('Filters Cleared');
                        }}
                        variant="outline"
                        className="bg-white hover:bg-gray-50"
                      >
                        Clear All
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            {showAdvancedFilters && (
              <CardContent>
                <Card className="bg-white border-green-200">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Search Events */}
                      <div>
                        <Label htmlFor="searchEvents">Search Events</Label>
                        <Input
                          id="searchEvents"
                          type="text"
                          value={advancedFilters.searchTerm}
                          onChange={(e) => setAdvancedFilters({ ...advancedFilters, searchTerm: e.target.value })}
                          placeholder="Search by title, description, or location..."
                        />
                      </div>

                      {/* Date Range */}
                      <div>
                        <Label>Date Range</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={advancedFilters.dateRange.start}
                            onChange={(e) => setAdvancedFilters({
                              ...advancedFilters,
                              dateRange: { ...advancedFilters.dateRange, start: e.target.value },
                            })}
                            placeholder="Start Date"
                          />
                          <Input
                            type="date"
                            value={advancedFilters.dateRange.end}
                            onChange={(e) => setAdvancedFilters({
                              ...advancedFilters,
                              dateRange: { ...advancedFilters.dateRange, end: e.target.value },
                            })}
                            placeholder="End Date"
                          />
                        </div>
                      </div>

                      {/* Sort By */}
                      <div>
                        <Label htmlFor="sortBy">Sort By</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={advancedFilters.sortBy}
                            onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, sortBy: value as any })}
                          >
                            <SelectTrigger id="sortBy">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="title">Title</SelectItem>
                              <SelectItem value="attendance">Attendance</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={advancedFilters.sortOrder}
                            onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, sortOrder: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">Ascending</SelectItem>
                              <SelectItem value="desc">Descending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Filter by Ministry (grouped by Apostolate) */}
                      <div>
                        <Label>Filter by Ministry</Label>
                        <div className="max-h-60 overflow-y-auto border rounded-lg p-3 space-y-4">
                          {APOSTOLATES.map((apostolate) => {
                            const apostolateMinistries = getMinistriesForApostolate(apostolate);
                            if (apostolateMinistries.length === 0) return null;
                            return (
                              <div key={apostolate} className="space-y-2">
                                <div className="font-semibold text-sm text-gray-700 border-b pb-1">
                                  {apostolate}
                                </div>
                                <div className="pl-2 space-y-1">
                                  {apostolateMinistries.map((ministry) => (
                                    <div key={ministry} className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={`ministry-${apostolate}-${ministry}`}
                                        checked={advancedFilters.ministries.includes(ministry)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setAdvancedFilters({
                                              ...advancedFilters,
                                              ministries: [...advancedFilters.ministries, ministry],
                                            });
                                          } else {
                                            setAdvancedFilters({
                                              ...advancedFilters,
                                              ministries: advancedFilters.ministries.filter(m => m !== ministry),
                                            });
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <Label htmlFor={`ministry-${apostolate}-${ministry}`} className="text-sm cursor-pointer">
                                        {ministry}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          {/* Show ministries from member data that are not in the official structure */}
                          {(() => {
                            const ministriesWithoutApostolate = memberMinistries.filter(m => 
                              !allMinistries.includes(m)
                            );
                            if (ministriesWithoutApostolate.length === 0) return null;
                            return (
                              <div className="space-y-2">
                                <div className="font-semibold text-sm text-gray-700 border-b pb-1">
                                  Other (from member data)
                                </div>
                                <div className="pl-2 space-y-1">
                                  {ministriesWithoutApostolate.map((ministry) => (
                                    <div key={ministry} className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={`ministry-other-${ministry}`}
                                        checked={advancedFilters.ministries.includes(ministry)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setAdvancedFilters({
                                              ...advancedFilters,
                                              ministries: [...advancedFilters.ministries, ministry],
                                            });
                                          } else {
                                            setAdvancedFilters({
                                              ...advancedFilters,
                                              ministries: advancedFilters.ministries.filter(m => m !== ministry),
                                            });
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <Label htmlFor={`ministry-other-${ministry}`} className="text-sm cursor-pointer">
                                        {ministry}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Filter by Event Type */}
                      <div>
                        <Label>Filter by Event Type</Label>
                        <div className="space-y-2 border rounded-lg p-2">
                          {['Community Worship', 'Word Sharing Circles', 'Special Event', 'Ministry Event', 'Training', 'Meeting'].map((type) => (
                            <div key={type} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`eventType-${type}`}
                                checked={advancedFilters.eventTypes.includes(type)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAdvancedFilters({
                                      ...advancedFilters,
                                      eventTypes: [...advancedFilters.eventTypes, type],
                                    });
                                  } else {
                                    setAdvancedFilters({
                                      ...advancedFilters,
                                      eventTypes: advancedFilters.eventTypes.filter(t => t !== type),
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                              <Label htmlFor={`eventType-${type}`} className="text-sm cursor-pointer">
                                {type}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Attendance Range */}
                      <div>
                        <Label>Attendance Range (%)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={advancedFilters.attendanceRange.min}
                            onChange={(e) => setAdvancedFilters({
                              ...advancedFilters,
                              attendanceRange: {
                                ...advancedFilters.attendanceRange,
                                min: parseInt(e.target.value) || 0,
                              },
                            })}
                            placeholder="Min"
                          />
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={advancedFilters.attendanceRange.max}
                            onChange={(e) => setAdvancedFilters({
                              ...advancedFilters,
                              attendanceRange: {
                                ...advancedFilters.attendanceRange,
                                max: parseInt(e.target.value) || 100,
                              },
                            })}
                            placeholder="Max"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            )}
          </Card>

          {/* Report Results */}
          {reportData && (
            <Card ref={reportResultsRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {reportType === ReportType.MEMBER && 'Member Report'}
                      {reportType === ReportType.ATTENDANCE && 'Attendance Report'}
                      {reportType === ReportType.REGISTRATION && 'Registration Report'}
                      {reportType === ReportType.EVENT && 'Event Report'}
                    </CardTitle>
                    {reportType === ReportType.MEMBER && filters.memberId && (
                      <p className="text-sm text-gray-600 mt-1">
                        {(() => {
                          const member = members.find(m => m.id === filters.memberId);
                          return member ? `${member.firstName} ${member.lastName} (${member.communityId})` : 'Selected Member';
                        })()}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">
                    Generated: {(reportData as any).summary?.generatedAt
                      ? formatDateTime((reportData as any).summary.generatedAt)
                      : 'N/A'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Statistics */}
                {'statistics' in reportData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {Object.entries(reportData.statistics).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {typeof value === 'number' ? value.toLocaleString() : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Data Table */}
                {'data' in reportData && reportData.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {reportType === ReportType.ATTENDANCE && (
                            <>
                              <TableHead>Member</TableHead>
                              <TableHead>Community ID</TableHead>
                              <TableHead>Event</TableHead>
                              <TableHead>Check-in Time</TableHead>
                              <TableHead>Method</TableHead>
                            </>
                          )}
                          {reportType === ReportType.REGISTRATION && (
                            <>
                              <TableHead>Name</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Event</TableHead>
                              <TableHead>Payment Status</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Room</TableHead>
                            </>
                          )}
                          {reportType === ReportType.MEMBER && (
                            <>
                              <TableHead>Name</TableHead>
                              <TableHead>Community ID</TableHead>
                              <TableHead>City</TableHead>
                              <TableHead>Encounter Type</TableHead>
                              <TableHead>Ministry</TableHead>
                              <TableHead>Status</TableHead>
                            </>
                          )}
                          {reportType === ReportType.EVENT && (
                            <>
                              <TableHead>Event</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Attendances</TableHead>
                              <TableHead>Registrations</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportType === ReportType.ATTENDANCE &&
                          (reportData as AttendanceReport).data.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {item.member.nickname
                                  ? `${item.member.nickname} ${item.member.lastName}`
                                  : `${item.member.firstName} ${item.member.lastName}`}
                              </TableCell>
                              <TableCell className="font-mono">{item.member.communityId}</TableCell>
                              <TableCell>{item.event.title}</TableCell>
                              <TableCell>{formatDateTime(item.checkInTime)}</TableCell>
                              <TableCell>
                                <Badge variant={item.method === 'QR_CODE' ? 'default' : 'secondary'}>
                                  {item.method}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}

                        {reportType === ReportType.REGISTRATION &&
                          (reportData as RegistrationReport).data.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {item.firstName} {item.lastName}
                              </TableCell>
                              <TableCell>
                                <Badge>{item.registrationType}</Badge>
                              </TableCell>
                              <TableCell>{item.event.title}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    item.paymentStatus === 'PAID'
                                      ? 'default'
                                      : item.paymentStatus === 'PENDING'
                                      ? 'secondary'
                                      : 'destructive'
                                  }
                                >
                                  {item.paymentStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.paymentAmount ? formatCurrency(item.paymentAmount) : '-'}
                              </TableCell>
                              <TableCell>{item.roomAssignment || '-'}</TableCell>
                            </TableRow>
                          ))}

                        {reportType === ReportType.MEMBER &&
                          (reportData as MemberReport).data.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {item.nickname
                                  ? `${item.nickname} ${item.lastName || ''}`
                                  : `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'N/A'}
                              </TableCell>
                              <TableCell className="font-mono">{item.communityId}</TableCell>
                              <TableCell>{item.city}</TableCell>
                              <TableCell>
                                {item.encounterType} {item.classNumber}
                              </TableCell>
                              <TableCell>{item.ministry || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={item.user?.isActive ? 'default' : 'secondary'}>
                                  {item.user?.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}

                        {reportType === ReportType.EVENT &&
                          (reportData as EventReport).data.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.title}</TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell>{formatDate(item.startDate)}</TableCell>
                              <TableCell>
                                <Badge>{item.status}</Badge>
                              </TableCell>
                              <TableCell>{item.attendances.length}</TableCell>
                              <TableCell>{item.registrations.length}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No data found for the selected filters.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Individual Attendance Report Dialog — card format: Community Worship and WSC for period with percentage */}
      <Dialog open={showIndividualReport} onOpenChange={setShowIndividualReport}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="individual-report-desc">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-800">
              Individual Attendance Report
            </DialogTitle>
            <DialogDescription id="individual-report-desc" className="sr-only">
              Attendance for Community Worship and Word Sharing Circles for the selected period with percentages.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const hasReportData = individualReportData && Array.isArray(individualReportData.data) && individualReportData.data.length > 0;
            const requested = requestedIndividualReport;
            const memberData = hasReportData
              ? individualReportData!.data[0]
              : (() => {
                  if (requested) {
                    return {
                      communityId: requested.communityId,
                      firstName: requested.firstName,
                      lastName: requested.lastName,
                      middleInitial: requested.middleInitial ?? '',
                      ministry: requested.ministry,
                      apostolate: requested.apostolate,
                      corporateWorshipAttended: 0,
                      wordSharingCirclesAttended: 0,
                      corporateWorshipPercentage: 0,
                      wordSharingCirclesPercentage: 0,
                      totalAttended: 0,
                      percentage: 0,
                    };
                  }
                  const reqMember = members.find(m => m.communityId === recurringReportConfig.memberId) || members.find(m => m.id === filters.memberId);
                  return {
                    communityId: reqMember?.communityId ?? '',
                    firstName: reqMember?.firstName ?? '',
                    lastName: reqMember?.lastName ?? '',
                    middleInitial: reqMember?.middleName ? reqMember.middleName.charAt(0).toUpperCase() : '',
                    ministry: reqMember?.ministry,
                    apostolate: reqMember?.apostolate,
                    corporateWorshipAttended: 0,
                    wordSharingCirclesAttended: 0,
                    corporateWorshipPercentage: 0,
                    wordSharingCirclesPercentage: 0,
                    totalAttended: 0,
                    percentage: 0,
                  };
                })();
            const member = members.find(m => m.communityId === (memberData.communityId || recurringReportConfig.memberId)) || members.find(m => m.id === filters.memberId);
            const startDate = requested?.startDate || recurringReportConfig.startDate || individualReportConfig.startDate || filters.startDate;
            const endDate = requested?.endDate || recurringReportConfig.endDate || individualReportConfig.endDate || filters.endDate;
            const totalCw = individualReportData?.statistics?.totalInstances?.corporateWorship ?? 0;
            const totalWsc = individualReportData?.statistics?.totalInstances?.wordSharingCircles ?? 0;

            return (
              <div className="space-y-6">
                {!hasReportData && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
                    No attendance data for this period. Showing member and period with zero attendance.
                  </div>
                )}

                {/* Individual Profile Information */}
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-purple-800">Individual Profile Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-purple-700">
                    <p><strong>Name:</strong> {memberData.lastName}, {memberData.firstName} {memberData.middleInitial || ''}</p>
                    <p><strong>Current Ministry:</strong> {member?.ministry || memberData.ministry || 'N/A'}</p>
                    <p><strong>Current Apostolate:</strong> {member?.apostolate || memberData.apostolate || 'N/A'}</p>
                    <p><strong>Period:</strong> {startDate ? formatDate(startDate) : '—'} – {endDate ? formatDate(endDate) : '—'}</p>
                  </CardContent>
                </Card>

                {/* Attendance cards: Community Worship and WSC for the period */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Member Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Member ID</p>
                          <p className="font-mono font-semibold">{memberData.communityId || '—'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Nickname</p>
                          <p>{member?.nickname || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600">Name</p>
                          <p className="font-semibold">{memberData.lastName}, {memberData.firstName} {memberData.middleInitial || ''}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600">Overall Attendance</p>
                          <p className="text-3xl font-bold text-purple-600">{memberData.percentage ?? 0}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Attendance for period
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-purple-50 border-purple-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Church className="w-5 h-5 text-purple-600" />
                              <h5 className="font-semibold text-purple-800">Community Worship</h5>
                            </div>
                            <p className="text-2xl font-bold text-purple-600">{memberData.corporateWorshipPercentage ?? 0}%</p>
                            <p className="text-sm text-gray-600">
                              {memberData.corporateWorshipAttended ?? 0}/{totalCw} attended
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50 border-blue-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="w-5 h-5 text-blue-600" />
                              <h5 className="font-semibold text-blue-800">Word Sharing Circles</h5>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{memberData.wordSharingCirclesPercentage ?? 0}%</p>
                            <p className="text-sm text-gray-600">
                              {memberData.wordSharingCirclesAttended ?? 0}/{totalWsc} attended
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {hasReportData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Attendance Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="font-mono text-xs">Member ID</TableHead>
                              <TableHead>Last Name</TableHead>
                              <TableHead>First Name</TableHead>
                              <TableHead>MI</TableHead>
                              <TableHead className="text-center">CW</TableHead>
                              <TableHead className="text-center">CW%</TableHead>
                              <TableHead className="text-center">WSC</TableHead>
                              <TableHead className="text-center">WSC%</TableHead>
                              <TableHead className="text-center">Total</TableHead>
                              <TableHead className="text-center">Overall%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-mono text-sm">{memberData.communityId}</TableCell>
                              <TableCell>{memberData.lastName}</TableCell>
                              <TableCell>{memberData.firstName}</TableCell>
                              <TableCell>{memberData.middleInitial || ''}</TableCell>
                              <TableCell className="text-center">{memberData.corporateWorshipAttended ?? 0}</TableCell>
                              <TableCell className="text-center font-medium text-purple-600">{memberData.corporateWorshipPercentage ?? 0}%</TableCell>
                              <TableCell className="text-center">{memberData.wordSharingCirclesAttended ?? 0}</TableCell>
                              <TableCell className="text-center font-medium text-blue-600">{memberData.wordSharingCirclesPercentage ?? 0}%</TableCell>
                              <TableCell className="text-center font-medium">{memberData.totalAttended ?? 0}</TableCell>
                              <TableCell className="text-center font-medium text-purple-600">{memberData.percentage ?? 0}%</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-wrap justify-end gap-3">
                  <Button onClick={() => setShowIndividualReport(false)} variant="outline">
                    Close
                  </Button>
                  {hasReportData && (
                    <Button 
                      onClick={() => {
                        if (!individualReportData) return;
                        const data = individualReportData.data || [];
                        const filename = `individual-attendance-report-${memberData.communityId}-${new Date().toISOString().split('T')[0]}`;
                        reportsService.exportToCSV(data, filename);
                        toast.success('Report Exported to CSV');
                      }} 
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                  <Button 
                    onClick={() => toast.info('Excel export coming soon')} 
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <LineChart className="w-4 h-4 mr-2" />
                    Export Excel
                  </Button>
                  <Button 
                    onClick={() => toast.info('PDF export coming soon')} 
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Recurring Attendance Report Dialog */}
      <Dialog open={showRecurringReport} onOpenChange={setShowRecurringReport}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-800">
              Recurring Attendance Report
            </DialogTitle>
          </DialogHeader>

          {recurringReportData && (
            <div className="space-y-6">
              {/* Report Header */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="text-xl font-semibold text-purple-800 mb-2">
                  {recurringReportConfig.reportType === RecurringReportType.COMMUNITY
                    ? 'Community Report – by Apostolate & Ministry'
                    : `${recurringReportConfig.ministry || 'All Ministries'} - ${recurringReportConfig.apostolate || 'All Apostolates'}`}
                </h4>
                <p className="text-purple-600">
                  Period: {recurringReportConfig.startDate} to {recurringReportConfig.endDate}
                  {recurringReportConfig.period && (
                    <span className="ml-2 text-purple-500">({recurringReportConfig.period})</span>
                  )}
                </p>
              </div>

              {/* Summary Statistics: Community vs Ministry/Individual */}
              {recurringReportConfig.reportType === RecurringReportType.COMMUNITY ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">{recurringReportData.statistics?.totalMinistries ?? 0}</div>
                    <div className="text-sm text-gray-600">Ministries</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">{recurringReportData.statistics?.totalMembers ?? 0}</div>
                    <div className="text-sm text-gray-600">Total Members</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-800">{recurringReportData.statistics?.communityCwPercentage ?? 0}%</div>
                    <div className="text-sm text-purple-600">CW % (vs 100%)</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-800">{recurringReportData.statistics?.communityWscPercentage ?? 0}%</div>
                    <div className="text-sm text-blue-600">WSC % (vs 100%)</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-800">{recurringReportData.statistics?.averageCwPercentageByMinistry ?? 0}%</div>
                    <div className="text-sm text-green-600">Avg CW % by Ministry</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-800">{recurringReportData.statistics?.averageWscPercentageByMinistry ?? 0}%</div>
                    <div className="text-sm text-green-600">Avg WSC % by Ministry</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">{recurringReportData.statistics?.totalMembers ?? 0}</div>
                    <div className="text-sm text-gray-600">Total Members</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-800">{recurringReportData.statistics?.averageAttendance ?? 0}%</div>
                    <div className="text-sm text-green-600">Average Attendance</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-800">{recurringReportData.statistics?.totalInstances?.corporateWorship ?? 0}</div>
                    <div className="text-sm text-purple-600">Community Worship Instances</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-800">{recurringReportData.statistics?.totalInstances?.wordSharingCircles ?? 0}</div>
                    <div className="text-sm text-blue-600">Word Sharing Circles Instances</div>
                  </div>
                </div>
              )}

              {/* Community Report: Apostolate / Ministry table (no per-member list) */}
              {recurringReportConfig.reportType === RecurringReportType.COMMUNITY &&
               Array.isArray(recurringReportData.data) &&
               recurringReportData.data.length > 0 &&
               'totalMembers' in recurringReportData.data[0] && (() => {
                const rows = recurringReportData.data as Array<CommunitySummaryRow>;
                const byApostolate = rows.reduce<Record<string, CommunitySummaryRow[]>>((acc, r) => {
                  const a = r.apostolate || 'Other';
                  if (!acc[a]) acc[a] = [];
                  acc[a].push(r);
                  return acc;
                }, {});
                const apostolateOrder = ['Pastoral Apostolate', 'Evangelization Apostolate', 'Formation Apostolate', 'Management Apostolate', 'Mission Apostolate'];
                const order = [...apostolateOrder.filter((a) => byApostolate[a]), ...Object.keys(byApostolate).filter((a) => !apostolateOrder.includes(a))];
                return (
                  <div className="space-y-4">
                    <h5 className="font-semibold text-gray-800">Attendance by Apostolate & Ministry (analytics for activity planning)</h5>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Apostolate</TableHead>
                            <TableHead>Ministry</TableHead>
                            <TableHead className="text-center">Total Members</TableHead>
                            <TableHead className="text-center">Total CW Attended</TableHead>
                            <TableHead className="text-center">CW % (vs 100%)</TableHead>
                            <TableHead className="text-center">Total WSC Attended</TableHead>
                            <TableHead className="text-center">WSC % (vs 100%)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.map((apostolate) => (
                            <Fragment key={apostolate}>
                              {byApostolate[apostolate].map((row, idx) => (
                                <TableRow key={`${row.apostolate}-${row.ministry}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <TableCell className="font-medium text-slate-700">{row.apostolate}</TableCell>
                                  <TableCell className="font-medium">{row.ministry}</TableCell>
                                  <TableCell className="text-center">{row.totalMembers}</TableCell>
                                  <TableCell className="text-center">{row.totalCwAttended}</TableCell>
                                  <TableCell className="text-center font-medium text-purple-600">{row.cwPercentage}%</TableCell>
                                  <TableCell className="text-center">{row.totalWscAttended}</TableCell>
                                  <TableCell className="text-center font-medium text-green-600">{row.wscPercentage}%</TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}

              {/* Member Attendance Table (Ministry/Individual only): always show table array first; rows or "No data" */}
              {recurringReportConfig.reportType !== RecurringReportType.COMMUNITY && (() => {
                const data = Array.isArray(recurringReportData.data) ? recurringReportData.data : [];
                const isMemberData = data.length > 0 && (data[0] as any)?.communityId != null;
                const dataRows = isMemberData ? (data as Array<{
                  id: string;
                  communityId: string;
                  firstName: string;
                  lastName: string;
                  middleInitial?: string;
                  middleName?: string;
                  meClass?: string;
                  corporateWorshipAttended: number;
                  wordSharingCirclesAttended: number;
                  totalCwInPeriod?: number;
                  totalWscInPeriod?: number;
                  corporateWorshipPercentage: number;
                  wordSharingCirclesPercentage: number;
                  totalAttended?: number;
                  percentage?: number;
                }>) : [];
                const ministry = recurringReportConfig.ministry || '';
                const groupByMeClass = ['Post-LSS Group (PLSG)', 'Service Ministry', 'Intercessory Ministry'].includes(ministry);
                const byMeClass = groupByMeClass && dataRows.length > 0
                  ? dataRows.reduce<Record<string, typeof dataRows>>((acc, m) => {
                      const key = m.meClass || 'Other';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(m);
                      return acc;
                    }, {})
                  : { '': dataRows };
                const meClassOrder = Object.keys(byMeClass).filter(Boolean).sort((a, b) => {
                  const aMatch = a.match(/^([A-Z]+)(\d+)$/);
                  const bMatch = b.match(/^([A-Z]+)(\d+)$/);
                  if (aMatch && bMatch) {
                    if (aMatch[1] !== bMatch[1]) return aMatch[1].localeCompare(bMatch[1]);
                    return parseInt(aMatch[2], 10) - parseInt(bMatch[2], 10);
                  }
                  return a.localeCompare(b);
                });
                if (!groupByMeClass) meClassOrder.push('');

                return (
                  <div className="space-y-2">
                    <h5 className="font-semibold text-gray-800">Member attendance (table array)</h5>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="font-mono text-xs">Community ID</TableHead>
                            <TableHead className="text-center">CW present</TableHead>
                            <TableHead className="text-center">Total CW</TableHead>
                            <TableHead className="text-center">CW %</TableHead>
                            <TableHead className="text-center">WSC present</TableHead>
                            <TableHead className="text-center">Total WSC</TableHead>
                            <TableHead className="text-center">WSC %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dataRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                No members found for this period/ministry. Check date range and ministry selection, or add members/attendance data.
                              </TableCell>
                            </TableRow>
                          ) : (
                            meClassOrder.map((meClass) => {
                              const rows = byMeClass[meClass] || [];
                              return (
                                <Fragment key={meClass || 'all'}>
                                  {groupByMeClass && meClass && (
                                    <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                                      <TableCell colSpan={8} className="font-semibold text-slate-700 py-2">
                                        ME Class {meClass}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {rows.map((member, idx) => {
                                    const middleInitial = member.middleInitial ||
                                      (member.middleName ? member.middleName.charAt(0).toUpperCase() : '');
                                    const name = [member.lastName, member.firstName].filter(Boolean).join(', ') + (middleInitial ? ` ${middleInitial}.` : '');
                                    return (
                                      <TableRow key={member.id || `${meClass}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <TableCell className="font-medium">{name}</TableCell>
                                        <TableCell className="font-mono text-sm">{member.communityId}</TableCell>
                                        <TableCell className="text-center">{member.corporateWorshipAttended ?? 0}</TableCell>
                                        <TableCell className="text-center text-slate-600">{member.totalCwInPeriod ?? recurringReportData.statistics?.totalInstances?.corporateWorship ?? '-'}</TableCell>
                                        <TableCell className="text-center font-medium text-purple-600">{member.corporateWorshipPercentage ?? 0}%</TableCell>
                                        <TableCell className="text-center">{member.wordSharingCirclesAttended ?? 0}</TableCell>
                                        <TableCell className="text-center text-slate-600">{member.totalWscInPeriod ?? recurringReportData.statistics?.totalInstances?.wordSharingCircles ?? '-'}</TableCell>
                                        <TableCell className="text-center font-medium text-green-600">{member.wordSharingCirclesPercentage ?? 0}%</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </Fragment>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}

              {/* Monthly attendance trend (Ministry only): CW % & WSC % per month */}
              {recurringReportConfig.reportType === RecurringReportType.MINISTRY && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Monthly attendance (CW % & WSC %)</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Periodic attendance by month for {recurringReportConfig.ministry || 'ministry'} — year {recurringReportConfig.selectedYear || new Date().getFullYear()}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {monthlyTrendLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : monthlyTrendChartData ? (
                      <div className="h-64">
                        <Bar
                          data={monthlyTrendChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } },
                            },
                          }}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">No monthly trend data for this year. Generate a ministry report to load the chart.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Export Buttons */}
              <div className="flex flex-wrap justify-end gap-3">
                <Button onClick={() => setShowRecurringReport(false)} variant="outline">
                  Close
                </Button>
                <Button onClick={exportRecurringReportToCSV} className="bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={exportRecurringReportToPDF} className="bg-red-600 hover:bg-red-700">
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
