'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Loader2,
  Download,
  FileText,
  Banknote,
  HelpCircle,
  Wallet,
  Receipt,
  PiggyBank,
  ClipboardList,
  Info,
} from 'lucide-react';
import { accountingService, type EventAccount, type IncomeEntry, type ExpenseEntry, type AdjustmentEntry, type FinancialReport, type CashAdvance, type MonitoredDisbursement } from '@/services/accounting.service';
import { eventsService, type Event } from '@/services/events.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/get-error-message';
import DashboardHeader from '@/components/layout/DashboardHeader';
import jsPDF from 'jspdf';

export default function EventAccountingPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.eventId as string;

  const [account, setAccount] = useState<EventAccount | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email?: string; phone?: string } | null>(null);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);

  // Income form state
  const [incomeForm, setIncomeForm] = useState({
    description: '',
    amount: '',
    source: '',
    remarks: '',
    orVoucherNumber: '',
    receivedAt: '',
  });

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: '',
    remarks: '',
    orVoucherNumber: '',
    paidAt: '',
  });

  // Adjustment form state
  const [adjustmentForm, setAdjustmentForm] = useState({
    description: '',
    amount: '',
    remarks: '',
    orVoucherNumber: '',
    adjustedAt: '',
  });

  const [showCaDialog, setShowCaDialog] = useState(false);
  const [editingCa, setEditingCa] = useState<CashAdvance | null>(null);
  const [caForm, setCaForm] = useState({
    amount: '',
    disbursedAt: '',
    payeeName: '',
    referenceNumber: '',
    notation: '',
  });

  const [showLiquidationDialog, setShowLiquidationDialog] = useState(false);
  const [liquidationTarget, setLiquidationTarget] = useState<CashAdvance | null>(null);
  const [liquidationNotation, setLiquidationNotation] = useState('');
  const [liquidationLines, setLiquidationLines] = useState<
    { description: string; amount: string; category: string; orVoucherNumber: string; paidAt: string }[]
  >([{ description: '', amount: '', category: '', orVoucherNumber: '', paidAt: '' }]);

  const [showMonitoredDialog, setShowMonitoredDialog] = useState(false);
  const [editingMonitored, setEditingMonitored] = useState<MonitoredDisbursement | null>(null);
  const [monitoredForm, setMonitoredForm] = useState({
    amount: '',
    disbursedAt: '',
    label: '',
    payeeName: '',
    referenceNumber: '',
    notation: '',
  });

  useEffect(() => {
    if (eventId) {
      loadData();
      loadCurrentUser();
    }
  }, [eventId]);

  // Load financial report whenever account or event data changes (real-time updates)
  useEffect(() => {
    if (account && event && eventId) {
      loadFinancialReport();
    }
  }, [account, event, eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountResult, eventResult] = await Promise.all([
        accountingService.getEventAccount(eventId),
        eventsService.getById(eventId),
      ]);

      if (accountResult.success && accountResult.data) {
        setAccount(accountResult.data);
      }

      if (eventResult.success && eventResult.data) {
        setEvent(eventResult.data);
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to load accounting data',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = () => {
    try {
      const authData = localStorage.getItem('authData');
      if (authData) {
        const parsed = JSON.parse(authData);
        const user = parsed.user;
        const member = parsed.member;
        
        let userName = 'User';
        if (member) {
          const nickname = member.nickname || member.firstName;
          userName = `${nickname} ${member.lastName}`;
        } else if (user?.email) {
          userName = user.email;
        } else if (user?.phone) {
          userName = user.phone;
        }
        
        setCurrentUser({
          name: userName,
          email: user?.email,
          phone: user?.phone,
        });
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadFinancialReport = async () => {
    if (!eventId) return;
    
    try {
      setReportLoading(true);
      const result = await accountingService.generateFinancialReport(eventId);
      
      if (result.success && result.data) {
        setFinancialReport(result.data);
      }
    } catch (error) {
      toast.error('Failed to load report', {
        description: getErrorMessage(error, 'Could not load financial report. Please try again.'),
      });
    } finally {
      setReportLoading(false);
    }
  };

  const handleAddIncome = () => {
    setEditingIncome(null);
    setIncomeForm({
      description: '',
      amount: '',
      source: '',
      remarks: '',
      orVoucherNumber: '',
      receivedAt: new Date().toISOString().split('T')[0],
    });
    setShowIncomeDialog(true);
  };

  const handleEditIncome = (entry: IncomeEntry) => {
    setEditingIncome(entry);
    setIncomeForm({
      description: entry.description,
      amount: entry.amount.toString(),
      source: entry.source || '',
      remarks: entry.remarks || '',
      orVoucherNumber: entry.orVoucherNumber || '',
      receivedAt: entry.receivedAt.split('T')[0],
    });
    setShowIncomeDialog(true);
  };

  const handleSaveIncome = async () => {
    if (!incomeForm.description || !incomeForm.amount) {
      toast.error('Error', {
        description: 'Please fill in all required fields',
      });
      return;
    }

    if (incomeForm.remarks && !validateWordCount(incomeForm.remarks, 5)) {
      toast.error('Error', {
        description: 'Remarks must be 5 words or less',
      });
      return;
    }

    try {
      if (editingIncome) {
        await accountingService.updateIncomeEntry(eventId, editingIncome.id, {
          description: incomeForm.description,
          amount: parseFloat(incomeForm.amount),
          source: incomeForm.source || undefined,
          remarks: incomeForm.remarks.trim() || undefined,
          orVoucherNumber: incomeForm.orVoucherNumber.trim() || undefined,
          receivedAt: incomeForm.receivedAt ? new Date(incomeForm.receivedAt).toISOString() : undefined,
        });
        toast.success('Income Entry Updated', {
          description: 'The income entry has been updated successfully.',
        });
      } else {
        await accountingService.createIncomeEntry(eventId, {
          description: incomeForm.description,
          amount: parseFloat(incomeForm.amount),
          source: incomeForm.source || undefined,
          remarks: incomeForm.remarks.trim() || undefined,
          orVoucherNumber: incomeForm.orVoucherNumber.trim() || undefined,
          receivedAt: incomeForm.receivedAt ? new Date(incomeForm.receivedAt).toISOString() : undefined,
        });
        toast.success('Income Entry Added', {
          description: 'The income entry has been added successfully.',
        });
      }
      setShowIncomeDialog(false);
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to save income entry');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleDeleteIncome = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this income entry?')) {
      return;
    }

    try {
      await accountingService.deleteIncomeEntry(eventId, entryId);
      toast.success('Income Entry Deleted', {
        description: 'The income entry has been deleted successfully.',
      });
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete income entry');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      description: '',
      amount: '',
      category: '',
      remarks: '',
      orVoucherNumber: '',
      paidAt: new Date().toISOString().split('T')[0],
    });
    setShowExpenseDialog(true);
  };

  const handleEditExpense = (entry: ExpenseEntry) => {
    setEditingExpense(entry);
    setExpenseForm({
      description: entry.description,
      amount: entry.amount.toString(),
      category: entry.category || '',
      remarks: entry.remarks || '',
      orVoucherNumber: entry.orVoucherNumber || '',
      paidAt: entry.paidAt.split('T')[0],
    });
    setShowExpenseDialog(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error('Error', {
        description: 'Please fill in all required fields',
      });
      return;
    }

    if (expenseForm.remarks && !validateWordCount(expenseForm.remarks, 5)) {
      toast.error('Error', {
        description: 'Remarks must be 5 words or less',
      });
      return;
    }

    try {
      if (editingExpense) {
        await accountingService.updateExpenseEntry(eventId, editingExpense.id, {
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category || undefined,
          remarks: expenseForm.remarks.trim() || undefined,
          orVoucherNumber: expenseForm.orVoucherNumber.trim() || undefined,
          paidAt: expenseForm.paidAt ? new Date(expenseForm.paidAt).toISOString() : undefined,
        });
        toast.success('Expense Entry Updated', {
          description: 'The expense entry has been updated successfully.',
        });
      } else {
        await accountingService.createExpenseEntry(eventId, {
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category || undefined,
          remarks: expenseForm.remarks.trim() || undefined,
          orVoucherNumber: expenseForm.orVoucherNumber.trim() || undefined,
          paidAt: expenseForm.paidAt ? new Date(expenseForm.paidAt).toISOString() : undefined,
        });
        toast.success('Expense Entry Added', {
          description: 'The expense entry has been added successfully.',
        });
      }
      setShowExpenseDialog(false);
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to save expense entry');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleDeleteExpense = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this expense entry?')) {
      return;
    }

    try {
      await accountingService.deleteExpenseEntry(eventId, entryId);
      toast.success('Expense Entry Deleted', {
        description: 'The expense entry has been deleted successfully.',
      });
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete expense entry');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleAddAdjustment = () => {
    setAdjustmentForm({
      description: '',
      amount: '',
      remarks: '',
      orVoucherNumber: '',
      adjustedAt: new Date().toISOString().split('T')[0],
    });
    setShowAdjustmentDialog(true);
  };

  const handleSaveAdjustment = async () => {
    if (!adjustmentForm.description || !adjustmentForm.amount) {
      toast.error('Error', {
        description: 'Please fill in all required fields',
      });
      return;
    }

    if (adjustmentForm.remarks && !validateWordCount(adjustmentForm.remarks, 5)) {
      toast.error('Error', {
        description: 'Remarks must be 5 words or less',
      });
      return;
    }

    try {
      await accountingService.createAdjustmentEntry(eventId, {
        description: adjustmentForm.description,
        amount: parseFloat(adjustmentForm.amount),
        remarks: adjustmentForm.remarks.trim() || undefined,
        orVoucherNumber: adjustmentForm.orVoucherNumber.trim() || undefined,
        adjustedAt: adjustmentForm.adjustedAt ? new Date(adjustmentForm.adjustedAt).toISOString() : undefined,
      });
      toast.success('Adjustment Entry Added', {
        description: 'The adjustment entry has been added successfully.',
      });
      setShowAdjustmentDialog(false);
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to save adjustment entry');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleDeleteAdjustment = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this adjustment entry?')) {
      return;
    }

    try {
      await accountingService.deleteAdjustmentEntry(eventId, entryId);
      toast.success('Adjustment Entry Deleted', {
        description: 'The adjustment entry has been deleted successfully.',
      });
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete adjustment entry');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const openCaDialog = (ca?: CashAdvance | null) => {
    if (ca) {
      setEditingCa(ca);
      setCaForm({
        amount: String(ca.amount),
        disbursedAt: ca.disbursedAt.split('T')[0],
        payeeName: ca.payeeName || '',
        referenceNumber: ca.referenceNumber || '',
        notation: ca.notation || '',
      });
    } else {
      setEditingCa(null);
      setCaForm({
        amount: '',
        disbursedAt: new Date().toISOString().split('T')[0],
        payeeName: '',
        referenceNumber: '',
        notation: '',
      });
    }
    setShowCaDialog(true);
  };

  const handleSaveCa = async () => {
    if (!caForm.amount) {
      toast.error('Amount required');
      return;
    }
    const amount = parseFloat(caForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    try {
      if (editingCa) {
        await accountingService.updateCashAdvance(eventId, editingCa.id, {
          amount,
          disbursedAt: caForm.disbursedAt ? new Date(caForm.disbursedAt).toISOString() : undefined,
          payeeName: caForm.payeeName.trim() || undefined,
          referenceNumber: caForm.referenceNumber.trim() || undefined,
          notation: caForm.notation.trim() || undefined,
        });
        toast.success('Cash advance updated');
      } else {
        await accountingService.createCashAdvance(eventId, {
          amount,
          disbursedAt: caForm.disbursedAt ? new Date(caForm.disbursedAt).toISOString() : undefined,
          payeeName: caForm.payeeName.trim() || undefined,
          referenceNumber: caForm.referenceNumber.trim() || undefined,
          notation: caForm.notation.trim() || undefined,
        });
        toast.success('Cash advance recorded');
      }
      setShowCaDialog(false);
      loadData();
    } catch (error: unknown) {
      toast.error('Error', { description: getErrorMessage(error, 'Failed to save cash advance') });
    }
  };

  const handleDeleteCa = async (ca: CashAdvance) => {
    if (!confirm('Delete this cash advance? (Only allowed if not yet liquidated.)')) return;
    try {
      await accountingService.deleteCashAdvance(eventId, ca.id);
      toast.success('Cash advance deleted');
      loadData();
    } catch (error: unknown) {
      toast.error('Error', { description: getErrorMessage(error, 'Failed to delete') });
    }
  };

  const openLiquidationDialog = (ca: CashAdvance) => {
    setLiquidationTarget(ca);
    const liq = ca.liquidation;
    setLiquidationNotation(liq?.notation || '');
    if (liq?.lines?.length) {
      setLiquidationLines(
        liq.lines.map((ln) => ({
          description: ln.description,
          amount: String(ln.amount),
          category: ln.category || '',
          orVoucherNumber: ln.orVoucherNumber || '',
          paidAt: ln.paidAt ? ln.paidAt.split('T')[0] : '',
        })),
      );
    } else {
      setLiquidationLines([{ description: '', amount: '', category: '', orVoucherNumber: '', paidAt: '' }]);
    }
    setShowLiquidationDialog(true);
  };

  const handleSaveLiquidationDraft = async () => {
    if (!liquidationTarget) return;
    const lines = liquidationLines
      .map((l) => ({
        description: l.description.trim(),
        amount: parseFloat(l.amount),
        category: l.category.trim() || undefined,
        orVoucherNumber: l.orVoucherNumber.trim() || undefined,
        paidAt: l.paidAt ? new Date(l.paidAt).toISOString() : undefined,
      }))
      .filter((l) => l.description.length > 0 && !isNaN(l.amount) && l.amount > 0);

    if (lines.length === 0) {
      toast.error('Add at least one line with description and amount');
      return;
    }

    try {
      const result = await accountingService.saveLiquidationDraft(eventId, liquidationTarget.id, {
        notation: liquidationNotation.trim() || undefined,
        lines,
      });
      if (result.success && result.data) {
        const liq = result.data as {
          id: string;
          cashAdvanceId: string;
          status: 'DRAFT' | 'APPROVED';
          notation: string | null;
          approvedAt: string | null;
          lines: Array<{
            id: string;
            description: string;
            amount: number;
            category: string | null;
            orVoucherNumber: string | null;
            paidAt: string | null;
          }>;
        };
        setLiquidationTarget((prev) =>
          prev
            ? {
                ...prev,
                liquidation: {
                  id: liq.id,
                  cashAdvanceId: liq.cashAdvanceId,
                  status: liq.status,
                  notation: liq.notation,
                  approvedAt: liq.approvedAt,
                  lines: liq.lines.map((ln) => ({
                    id: ln.id,
                    liquidationId: liq.id,
                    description: ln.description,
                    amount: Number(ln.amount),
                    category: ln.category,
                    orVoucherNumber: ln.orVoucherNumber,
                    paidAt: ln.paidAt,
                  })),
                },
              }
            : prev,
        );
        toast.success('Liquidation draft saved — you can approve when ready');
        loadData();
      }
    } catch (error: unknown) {
      toast.error('Error', { description: getErrorMessage(error, 'Failed to save liquidation') });
    }
  };

  const handleApproveLiquidation = async () => {
    if (!liquidationTarget?.liquidation?.id) {
      toast.error('Save a draft first');
      return;
    }
    if (
      !confirm(
        'Finalize this packet? Each receipt line will appear under “Money spent,” and this cash advance will show as settled. Double-check amounts first.',
      )
    ) {
      return;
    }
    try {
      await accountingService.approveLiquidation(eventId, liquidationTarget.liquidation.id);
      toast.success('Done — expenses are now on the books');
      setShowLiquidationDialog(false);
      loadData();
    } catch (error: unknown) {
      toast.error('Error', { description: getErrorMessage(error, 'Failed to approve') });
    }
  };

  const openMonitoredDialog = (row?: MonitoredDisbursement | null) => {
    if (row) {
      setEditingMonitored(row);
      setMonitoredForm({
        amount: String(row.amount),
        disbursedAt: row.disbursedAt.split('T')[0],
        label: row.label || '',
        payeeName: row.payeeName || '',
        referenceNumber: row.referenceNumber || '',
        notation: row.notation || '',
      });
    } else {
      setEditingMonitored(null);
      setMonitoredForm({
        amount: '',
        disbursedAt: new Date().toISOString().split('T')[0],
        label: '',
        payeeName: '',
        referenceNumber: '',
        notation: '',
      });
    }
    setShowMonitoredDialog(true);
  };

  const handleSaveMonitored = async () => {
    if (!monitoredForm.amount) {
      toast.error('Amount required');
      return;
    }
    const amount = parseFloat(monitoredForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    try {
      if (editingMonitored) {
        await accountingService.updateMonitoredDisbursement(eventId, editingMonitored.id, {
          amount,
          disbursedAt: monitoredForm.disbursedAt ? new Date(monitoredForm.disbursedAt).toISOString() : undefined,
          label: monitoredForm.label.trim() || undefined,
          payeeName: monitoredForm.payeeName.trim() || undefined,
          referenceNumber: monitoredForm.referenceNumber.trim() || undefined,
          notation: monitoredForm.notation.trim() || undefined,
        });
        toast.success('Updated');
      } else {
        await accountingService.createMonitoredDisbursement(eventId, {
          amount,
          disbursedAt: monitoredForm.disbursedAt ? new Date(monitoredForm.disbursedAt).toISOString() : undefined,
          label: monitoredForm.label.trim() || undefined,
          payeeName: monitoredForm.payeeName.trim() || undefined,
          referenceNumber: monitoredForm.referenceNumber.trim() || undefined,
          notation: monitoredForm.notation.trim() || undefined,
        });
        toast.success('Recorded');
      }
      setShowMonitoredDialog(false);
      loadData();
    } catch (error: unknown) {
      toast.error('Error', { description: getErrorMessage(error, 'Failed to save') });
    }
  };

  const handleDeleteMonitored = async (row: MonitoredDisbursement) => {
    if (!confirm('Delete this monitored disbursement?')) return;
    try {
      await accountingService.deleteMonitoredDisbursement(eventId, row.id);
      toast.success('Deleted');
      loadData();
    } catch (error: unknown) {
      toast.error('Error', { description: getErrorMessage(error, 'Failed to delete') });
    }
  };

  const handleCloseAccount = async () => {
    if (!confirm('Are you sure you want to close this account? You will not be able to add or modify entries.')) {
      return;
    }

    try {
      await accountingService.closeEventAccount(eventId);
      toast.success('Account Closed', {
        description: 'The account has been closed successfully.',
      });
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to close account');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleReopenAccount = async () => {
    try {
      await accountingService.reopenEventAccount(eventId);
      toast.success('Account Reopened', {
        description: 'The account has been reopened successfully.',
      });
      loadData();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to reopen account');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleDownloadReport = async () => {
    try {
      const result = await accountingService.generateFinancialReport(eventId);
      if (result.success && result.data) {
        downloadFinancialReportCSV(result.data);
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to generate report');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleDownloadPDF = async () => {
    try {
      if (!financialReport || !event || !currentUser) {
        toast.error('Error', {
          description: 'Report data not available',
        });
        return;
      }
      downloadFinancialReportPDF(financialReport, event, currentUser);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to generate PDF');
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const downloadFinancialReportCSV = (report: FinancialReport) => {
    // Format date helper
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
      }).format(amount);
    };

    // Create CSV content
    let csvContent = '';

    // Header
    csvContent += `EVENT FINANCIAL REPORT\n`;
    csvContent += `Event: ${report.event.title}\n`;
    csvContent += `Date: ${formatDate(report.event.startDate)} - ${formatDate(report.event.endDate)}\n`;
    csvContent += `Location: ${report.event.location}${report.event.venue ? ` (${report.event.venue})` : ''}\n`;
    csvContent += `Status: ${report.event.status}\n`;
    csvContent += `Account Status: ${report.account.isClosed ? 'Closed' : 'Open'}\n`;
    csvContent += `Generated: ${formatDate(report.generatedAt)}\n\n`;

    // Summary Analysis
    csvContent += `FINANCIAL SUMMARY\n`;
    csvContent += `Total Income,${formatCurrency(report.summary.totalIncome)}\n`;
    csvContent += `Total Expenses,${formatCurrency(report.summary.totalExpenses)}\n`;
    csvContent += `Total Adjustments,${formatCurrency(report.summary.totalAdjustments)}\n`;
    csvContent += `Net Balance,${formatCurrency(report.summary.netBalance)}\n`;
    csvContent += `Profit Margin,${report.summary.profitMargin}%\n`;
    csvContent += `Expense Ratio,${report.summary.expenseRatio}%\n`;
    csvContent += `Income Entries,${report.summary.incomeCount}\n`;
    csvContent += `Expense Entries,${report.summary.expenseCount}\n`;
    csvContent += `Adjustment Entries,${report.summary.adjustmentCount}\n\n`;

    // Income by Source Analysis
    csvContent += `INCOME BY SOURCE\n`;
    csvContent += `Source,Total Amount,Entry Count\n`;
    report.incomeBySource.forEach((item) => {
      csvContent += `${item.source},${formatCurrency(item.total)},${item.count}\n`;
    });
    csvContent += `\n`;

    // Expenses by Category Analysis
    csvContent += `EXPENSES BY CATEGORY\n`;
    csvContent += `Category,Total Amount,Entry Count\n`;
    report.expensesByCategory.forEach((item) => {
      csvContent += `${item.category},${formatCurrency(item.total)},${item.count}\n`;
    });
    csvContent += `\n`;

    // Detailed Income Entries
    csvContent += `DETAILED INCOME ENTRIES\n`;
    csvContent += `Date,OR/ Voucher No.,Description,Source,Amount,Remarks\n`;
    report.incomeEntries.forEach((entry) => {
      csvContent += `${formatDate(entry.date)},${entry.orNumber || ''},${entry.description},${entry.source},${formatCurrency(entry.amount)},${entry.remarks || ''}\n`;
    });
    csvContent += `\n`;

    // Detailed Expense Entries
    csvContent += `DETAILED EXPENSE ENTRIES\n`;
    csvContent += `Date,OR/ Voucher No.,Description,Category,Amount,Remarks\n`;
    report.expenseEntries.forEach((entry) => {
      csvContent += `${formatDate(entry.date)},${entry.orNumber || ''},${entry.description},${entry.category},${formatCurrency(entry.amount)},${entry.remarks || ''}\n`;
    });
    csvContent += `\n`;

    // Adjustment Entries
    if (report.adjustmentEntries.length > 0) {
      csvContent += `ADJUSTMENT ENTRIES\n`;
      csvContent += `Date,Description,Amount,Remarks\n`;
      report.adjustmentEntries.forEach((entry) => {
        csvContent += `${formatDate(entry.date)},${entry.description},${formatCurrency(entry.amount)},${entry.remarks || ''}\n`;
      });
    }

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Financial_Report_${report.event.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Report Downloaded', {
      description: 'Financial report has been downloaded successfully.',
    });
  };

  const downloadFinancialReportPDF = (report: FinancialReport, event: Event, user: { name: string; email?: string; phone?: string }) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    const margin = 20;
    const lineHeight = 7;
    const sectionSpacing = 10;

    // Helper functions
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
      }).format(amount);
    };

    const addNewPageIfNeeded = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BLD Cebu', pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight + 5;

    doc.setFontSize(16);
    doc.text(event.title, pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const eventDate = `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`;
    doc.text(eventDate, pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight + 2;

    doc.setFontSize(10);
    doc.text(`Generated by: ${user.name}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight + 2;
    doc.text(`Generated on: ${formatDate(report.generatedAt)}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += sectionSpacing + 5;

    // Financial Summary Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Financial Summary', margin, yPos);
    yPos += lineHeight + 3;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryData = [
      ['Total Income', formatCurrency(report.summary.totalIncome)],
      ['Total Expenses', formatCurrency(report.summary.totalExpenses)],
      ['Total Adjustments', formatCurrency(report.summary.totalAdjustments)],
      ['Net Balance', formatCurrency(report.summary.netBalance)],
      ['Profit Margin', `${report.summary.profitMargin}%`],
      ['Expense Ratio', `${report.summary.expenseRatio}%`],
    ];

    summaryData.forEach(([label, value]) => {
      addNewPageIfNeeded(lineHeight + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', margin, yPos);
      doc.setFont('helvetica', 'normal');
      const xPos = margin + 80;
      doc.text(value, xPos, yPos);
      yPos += lineHeight + 2;
    });

    // Determine Surplus/Deficit
    yPos += 3;
    addNewPageIfNeeded(lineHeight + 5);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const netBalance = report.summary.netBalance;
    if (netBalance >= 0) {
      doc.setTextColor(0, 128, 0); // Green
      doc.text(`✓ SURPLUS: ${formatCurrency(netBalance)}`, pageWidth / 2, yPos, { align: 'center' });
    } else {
      doc.setTextColor(255, 0, 0); // Red
      doc.text(`✗ DEFICIT: ${formatCurrency(netBalance)}`, pageWidth / 2, yPos, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0); // Reset to black
    yPos += sectionSpacing + 5;

    // Income by Source
    if (report.incomeBySource.length > 0) {
      addNewPageIfNeeded(sectionSpacing + 20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Income by Source', margin, yPos);
      yPos += lineHeight + 3;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      report.incomeBySource.forEach((item) => {
        addNewPageIfNeeded(lineHeight + 3);
        doc.text(`${item.source}: ${formatCurrency(item.total)} (${item.count} entries)`, margin + 5, yPos);
        yPos += lineHeight + 2;
      });
      yPos += sectionSpacing;
    }

    // Expenses by Category
    if (report.expensesByCategory.length > 0) {
      addNewPageIfNeeded(sectionSpacing + 20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Expenses by Category', margin, yPos);
      yPos += lineHeight + 3;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      report.expensesByCategory.forEach((item) => {
        addNewPageIfNeeded(lineHeight + 3);
        doc.text(`${item.category}: ${formatCurrency(item.total)} (${item.count} entries)`, margin + 5, yPos);
        yPos += lineHeight + 2;
      });
      yPos += sectionSpacing;
    }

    // Detailed Income Entries
    if (report.incomeEntries.length > 0) {
      addNewPageIfNeeded(sectionSpacing + 20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Income Entries', margin, yPos);
      yPos += lineHeight + 3;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      report.incomeEntries.forEach((entry) => {
        addNewPageIfNeeded(lineHeight + 5);
        const orNum = entry.orNumber || 'N/A';
        const entryText = `${formatDate(entry.date)} | OR/Voucher: ${orNum} | ${entry.description} (${entry.source}): ${formatCurrency(entry.amount)}`;
        const lines = doc.splitTextToSize(entryText, pageWidth - 2 * margin);
        doc.text(lines, margin + 5, yPos);
        yPos += (lines.length * lineHeight) + 2;
      });
      yPos += sectionSpacing;
    }

    // Detailed Expense Entries
    if (report.expenseEntries.length > 0) {
      addNewPageIfNeeded(sectionSpacing + 20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Expense Entries', margin, yPos);
      yPos += lineHeight + 3;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      report.expenseEntries.forEach((entry) => {
        addNewPageIfNeeded(lineHeight + 5);
        const orNum = entry.orNumber || 'N/A';
        const entryText = `${formatDate(entry.date)} | OR/Voucher: ${orNum} | ${entry.description} (${entry.category}): ${formatCurrency(entry.amount)}`;
        const lines = doc.splitTextToSize(entryText, pageWidth - 2 * margin);
        doc.text(lines, margin + 5, yPos);
        yPos += (lines.length * lineHeight) + 2;
      });
      yPos += sectionSpacing;
    }

    // Adjustment Entries
    if (report.adjustmentEntries.length > 0) {
      addNewPageIfNeeded(sectionSpacing + 20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Adjustment Entries', margin, yPos);
      yPos += lineHeight + 3;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      report.adjustmentEntries.forEach((entry) => {
        addNewPageIfNeeded(lineHeight + 5);
        const entryText = `${formatDate(entry.date)} - ${entry.description}: ${formatCurrency(entry.amount)}`;
        const lines = doc.splitTextToSize(entryText, pageWidth - 2 * margin);
        doc.text(lines, margin + 5, yPos);
        yPos += (lines.length * lineHeight) + 2;
      });
    }

    // Save PDF
    const fileName = `Financial_Report_${event.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    toast.success('PDF Downloaded', {
      description: 'Financial report PDF has been downloaded successfully.',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const limitWords = (text: string | null | undefined, maxWords: number = 5): string => {
    if (!text) return '-';
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  // Generate OR number from entry ID and date (same format as backend)
  const generateORNumber = (entryId: string, date: Date | string | null | undefined): string => {
    try {
      if (!entryId || !date) return 'N/A';
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return 'N/A';
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const idSuffix = entryId.length >= 5 
        ? entryId.substring(entryId.length - 5).toUpperCase()
        : entryId.toUpperCase().padStart(5, '0');
      return `OR-${year}${month}${day}-${idSuffix}`;
    } catch (error) {
      console.error('Error generating OR number:', error);
      return 'N/A';
    }
  };

  const validateWordCount = (text: string, maxWords: number = 5): boolean => {
    if (!text.trim()) return true; // Empty is allowed
    const words = text.trim().split(/\s+/);
    return words.length <= maxWords;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/80">
        <DashboardHeader />
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-rose-600" aria-hidden />
            <p className="text-gray-700 font-medium">Gathering this event’s money details…</p>
            <p className="text-sm text-gray-500 max-w-sm">This usually takes a moment.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!account || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Card className="border-dashed">
            <CardContent className="pt-10 pb-10 text-center">
              <p className="text-gray-800 font-medium">We couldn’t load this event</p>
              <p className="text-sm text-gray-500 mt-2">Go back and pick an event from the list.</p>
              <Button variant="outline" className="mt-6" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/90">
      <DashboardHeader />
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Hero + actions */}
        <div className="mb-8 rounded-2xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/40 to-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Event money summary</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{event.title}</h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
                Track what came in, what went out, and what’s left — in plain language. Download matches what you see here.
              </p>
              {account.isClosed ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-900 ring-1 ring-amber-200">
                  <Lock className="w-4 h-4 shrink-0" aria-hidden />
                  <span>View only — this account was finalized. Reopen below to make changes.</span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end shrink-0">
              <Button
                onClick={handleDownloadReport}
                variant="outline"
                className="border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Spreadsheet (CSV)
              </Button>
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                className="border-violet-200 bg-white text-violet-900 hover:bg-violet-50"
                disabled={!financialReport || !event || !currentUser}
              >
                <FileText className="w-4 h-4 mr-2" />
                Printable report (PDF)
              </Button>
              {account.isClosed ? (
                <Button
                  onClick={handleReopenAccount}
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Reopen for edits
                </Button>
              ) : (
                <Button
                  onClick={handleCloseAccount}
                  variant="outline"
                  className="border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Lock &amp; finalize
                </Button>
              )}
            </div>
          </div>

          <details className="group mt-6 rounded-xl border border-gray-200/80 bg-white/70 p-4 text-sm shadow-sm open:shadow-md transition-shadow">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
              <HelpCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              <span>How this screen works</span>
              <span className="ml-auto text-xs font-normal text-gray-500 group-open:hidden">Tap to expand</span>
            </summary>
            <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-gray-600 leading-relaxed">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" aria-hidden />
                <span><strong className="text-gray-800">Money in</strong> — donations, fees, and other receipts you record.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden />
                <span><strong className="text-gray-800">Money spent</strong> — real costs (including after you settle a cash advance with receipts).</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                <span><strong className="text-gray-800">Cash given up front</strong> — you note who received it; actual spending is recorded when they turn in receipts.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                <span><strong className="text-gray-800">Other cash out (notes)</strong> — optional reminders of money that left the team; does not change the “spent” total by itself.</span>
              </li>
            </ul>
          </details>
        </div>

        {/* At a glance */}
        <section className="mb-8" aria-labelledby="at-a-glance-heading">
          <h2 id="at-a-glance-heading" className="sr-only">
            Summary at a glance
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="overflow-hidden border-green-200/80 bg-gradient-to-br from-green-50 to-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-green-900">
                  <PiggyBank className="h-4 w-4 text-green-700" aria-hidden />
                  Money received
                </CardTitle>
                <p className="text-xs text-green-800/80">Total inflow you recorded</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold tabular-nums text-green-950 sm:text-3xl">
                  {formatCurrency(account.summary?.totalIncome || 0)}
                </p>
                <p className="mt-1 text-xs text-green-800/90">
                  {account.summary?.incomeCount || 0} {account.summary?.incomeCount === 1 ? 'line' : 'lines'}
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-rose-200/80 bg-gradient-to-br from-rose-50 to-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-rose-900">
                  <Receipt className="h-4 w-4 text-rose-700" aria-hidden />
                  Money spent (recorded)
                </CardTitle>
                <p className="text-xs text-rose-800/80">Expenses &amp; settled receipts</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold tabular-nums text-rose-950 sm:text-3xl">
                  {formatCurrency(account.summary?.totalExpenses || 0)}
                </p>
                <p className="mt-1 text-xs text-rose-800/90">
                  {account.summary?.expenseCount || 0} {account.summary?.expenseCount === 1 ? 'line' : 'lines'}
                </p>
              </CardContent>
            </Card>

            <Card
              className={`overflow-hidden shadow-sm sm:col-span-2 lg:col-span-1 ${
                (account.summary?.netBalance || 0) >= 0
                  ? 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-white'
                  : 'border-orange-200/80 bg-gradient-to-br from-orange-50 to-white'
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Wallet className="h-4 w-4 text-gray-700" aria-hidden />
                  What’s left
                </CardTitle>
                <p className="text-xs text-gray-600">Received minus spent (plus any adjustments)</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p
                  className={`text-2xl font-bold tabular-nums sm:text-3xl ${
                    (account.summary?.netBalance || 0) >= 0 ? 'text-sky-950' : 'text-orange-950'
                  }`}
                >
                  {formatCurrency(account.summary?.netBalance || 0)}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {(account.summary?.netBalance || 0) >= 0 ? 'Surplus for this event' : 'Shortfall — review income & spending'}
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-amber-200/80 bg-gradient-to-br from-amber-50 to-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                  <Banknote className="h-4 w-4" aria-hidden />
                  Cash given in advance
                </CardTitle>
                <p className="text-xs text-amber-900/85">Total released to people up front</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold tabular-nums text-amber-950 sm:text-3xl">
                  {formatCurrency(account.summary?.totalCashAdvanceDisbursed ?? 0)}
                </p>
                <p className="mt-1 text-xs text-amber-900/90">For tracking; spending counts after settlement</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200/90 bg-gradient-to-br from-slate-50 to-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ClipboardList className="h-4 w-4 text-slate-700" aria-hidden />
                  Other cash out (notes)
                </CardTitle>
                <p className="text-xs text-slate-600">Optional — for your own visibility</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold tabular-nums text-slate-950 sm:text-3xl">
                  {formatCurrency(account.summary?.totalMonitoredDisbursement ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-600">Does not add to “spent” by itself</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-teal-200/80 bg-gradient-to-br from-teal-50 to-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                  <Info className="h-4 w-4 text-teal-700" aria-hidden />
                  Advances waiting for receipts
                </CardTitle>
                <p className="text-xs text-teal-900/85">Still to be settled with ORs</p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold tabular-nums text-teal-950 sm:text-3xl">
                  {formatCurrency(account.summary?.outstandingCashAdvanceAmount ?? 0)}
                </p>
                <p className="mt-1 text-xs text-teal-900/90">
                  {account.summary?.outstandingCashAdvanceCount ?? 0}{' '}
                  {account.summary?.outstandingCashAdvanceCount === 1 ? 'advance' : 'advances'} open
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Cash advances — plain-language flow */}
        <Card className="mb-6 overflow-hidden border-amber-200/90 shadow-md">
          <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50/90 to-white px-6 py-4 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">When you give cash up front</CardTitle>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                  Use this when someone receives cash before the actual receipts exist. Later, they list each real expense with OR numbers — only then does it count as “spent” in the red summary above.
                </p>
                <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                  <li className="flex min-w-0 items-start gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm shadow-sm ring-1 ring-amber-100">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                      1
                    </span>
                    <span>
                      <span className="font-semibold text-gray-900">Record the release</span>
                      <span className="block text-gray-600">Who, how much, DV or ref if any</span>
                    </span>
                  </li>
                  <li className="flex min-w-0 items-start gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm shadow-sm ring-1 ring-amber-100">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                      2
                    </span>
                    <span>
                      <span className="font-semibold text-gray-900">Add each receipt line</span>
                      <span className="block text-gray-600">Save progress anytime</span>
                    </span>
                  </li>
                  <li className="flex min-w-0 items-start gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm shadow-sm ring-1 ring-amber-100">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                      3
                    </span>
                    <span>
                      <span className="font-semibold text-gray-900">Finalize</span>
                      <span className="block text-gray-600">Posts real expenses — check numbers first</span>
                    </span>
                  </li>
                </ol>
              </div>
              {!account.isClosed && (
                <Button
                  onClick={() => openCaDialog()}
                  className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"
                  size="lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Record cash release
                </Button>
              )}
            </div>
          </div>
          <CardContent className="px-4 py-6 sm:px-8">
            {!account.cashAdvances?.length ? (
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/30 px-6 py-12 text-center">
                <Banknote className="mx-auto h-12 w-12 text-amber-400" aria-hidden />
                <p className="mt-4 font-medium text-gray-800">No cash advances yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                  When your team gives cash before receipts arrive, tap <strong>Record cash release</strong> so nothing is forgotten.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                      <TableHead className="whitespace-nowrap">When</TableHead>
                      <TableHead>Who / reference</TableHead>
                      <TableHead className="min-w-[140px]">Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {!account.isClosed && <TableHead className="text-right w-[1%]">Next step</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.cashAdvances.map((ca) => (
                      <TableRow key={ca.id} className="align-top">
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(ca.disbursedAt)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900">{ca.payeeName || '—'}</div>
                          <div className="text-xs text-gray-500">{ca.referenceNumber ? `Ref: ${ca.referenceNumber}` : 'No ref yet'}</div>
                        </TableCell>
                        <TableCell className="max-w-[220px] text-sm text-gray-700 whitespace-pre-wrap">
                          {ca.notation || '—'}
                        </TableCell>
                        <TableCell>
                          {ca.status === 'LIQUIDATED' ? (
                            <Badge className="border-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Settled with receipts</Badge>
                          ) : ca.liquidation?.status === 'DRAFT' ? (
                            <Badge variant="outline" className="border-amber-400 text-amber-950">
                              Receipts in progress
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-700">
                              Needs receipt list
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(ca.amount)}</TableCell>
                        {!account.isClosed && (
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-1">
                              {ca.status === 'OUTSTANDING' && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => openCaDialog(ca)} className="text-xs h-8">
                                    <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 bg-amber-600 text-xs text-white hover:bg-amber-700"
                                    onClick={() => openLiquidationDialog(ca)}
                                  >
                                    {ca.liquidation?.status === 'DRAFT' ? 'Continue receipts' : 'Add receipts'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteCa(ca)}
                                    aria-label="Remove this cash advance"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Other money out (optional notes)</CardTitle>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                  Use this to remember cash that left for other reasons (e.g. quick reimbursements). It helps your team stay aligned — it does <strong>not</strong> replace entering real expenses below.
                </p>
              </div>
              {!account.isClosed && (
                <Button onClick={() => openMonitoredDialog()} variant="secondary" className="shrink-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Add a note
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!account.monitoredDisbursements?.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-gray-600">
                Nothing here yet — add only if it helps your team remember a payout.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead>When</TableHead>
                      <TableHead>What you call it</TableHead>
                      <TableHead>Who / reference</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {!account.isClosed && <TableHead className="text-right"> </TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.monitoredDisbursements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(m.disbursedAt)}</TableCell>
                        <TableCell className="font-medium">{m.label || '—'}</TableCell>
                        <TableCell>
                          <div>{m.payeeName || '—'}</div>
                          <div className="text-xs text-gray-500">{m.referenceNumber || ''}</div>
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm whitespace-pre-wrap">{m.notation || '—'}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(m.amount)}</TableCell>
                        {!account.isClosed && (
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openMonitoredDialog(m)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteMonitored(m)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income */}
        <Card className="mb-6 overflow-hidden border-emerald-100/80 shadow-sm">
          <CardHeader className="border-b border-emerald-50 bg-emerald-50/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Money in</CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  Donations, registration fees, and other money received — include OR or reference when you have it.
                </p>
              </div>
              {!account.isClosed && (
                <Button onClick={handleAddIncome} size="sm" className="shrink-0 bg-emerald-700 hover:bg-emerald-800">
                  <Plus className="w-4 h-4 mr-2" />
                  Add money in
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {(!account.incomeEntries || account.incomeEntries.length === 0) ? (
              <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-600">
                No entries yet — when someone pays or gives, add it here.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>OR/ Voucher No.</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {!account.isClosed && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.incomeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.receivedAt)}</TableCell>
                      <TableCell className="text-sm font-mono text-gray-600">
                        {entry.orVoucherNumber || generateORNumber(entry.id, entry.receivedAt)}
                      </TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>{entry.source || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{limitWords(entry.remarks)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      {!account.isClosed && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditIncome(entry)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteIncome(entry.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="mb-6 overflow-hidden border-rose-100/80 shadow-sm">
          <CardHeader className="border-b border-rose-50 bg-rose-50/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Money spent</CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  Day-to-day costs you enter yourself. Lines from settled cash advances appear here automatically — look for the “From settlement” tag.
                </p>
              </div>
              {!account.isClosed && (
                <Button onClick={handleAddExpense} size="sm" variant="destructive" className="shrink-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Add expense
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {(!account.expenseEntries || account.expenseEntries.length === 0) ? (
              <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-600">
                No expenses yet — or they may all come from settling cash advances above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>OR/ Voucher No.</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {!account.isClosed && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.expenseEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.paidAt)}</TableCell>
                      <TableCell className="text-sm font-mono text-gray-600">
                        {entry.orVoucherNumber || generateORNumber(entry.id, entry.paidAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.description}
                          {entry.liquidationLineId ? (
                            <Badge variant="outline" className="text-xs border-violet-300 bg-violet-50 text-violet-900">
                              From settlement
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{entry.category || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{limitWords(entry.remarks)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      {!account.isClosed && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!entry.liquidationLineId ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditExpense(entry)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteExpense(entry.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-500">Locked — from settlement</span>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Adjustments */}
        <Card className="mb-6 overflow-hidden border-violet-100/80 shadow-sm">
          <CardHeader className="border-b border-violet-50 bg-violet-50/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Corrections &amp; fine-tuning</CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  Rare fixes (rounding, approved corrections). Positive adds to what’s left; negative reduces it. Ask a lead if unsure.
                </p>
              </div>
              {!account.isClosed && (
                <Button onClick={handleAddAdjustment} size="sm" variant="outline" className="shrink-0 border-violet-300">
                  <Plus className="w-4 h-4 mr-2" />
                  Add correction
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {(!account.adjustmentEntries || account.adjustmentEntries.length === 0) ? (
              <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-600">
                None — most events don’t need this.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>OR/ Voucher No.</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {!account.isClosed && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.adjustmentEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.adjustedAt)}</TableCell>
                      <TableCell className="text-sm font-mono text-gray-600">
                        {entry.orVoucherNumber || generateORNumber(entry.id, entry.adjustedAt)}
                      </TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell className="text-sm text-gray-600">{limitWords(entry.remarks)}</TableCell>
                      <TableCell className={`text-right font-semibold ${entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      {!account.isClosed && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAdjustment(entry.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Financial Report Section */}
        <Card className="mb-6">
          <CardHeader className="border-b border-gray-100">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Full report preview</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Same totals as your downloads — use this before sharing.</p>
              </div>
              {reportLoading && (
                <Loader2 className="w-5 h-5 animate-spin text-rose-500 shrink-0" aria-label="Loading report" />
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {reportLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                <span className="text-gray-700 font-medium">Preparing your numbers…</span>
                <span className="text-sm text-gray-500">Almost there.</span>
              </div>
            ) : financialReport ? (
              <div className="space-y-6">
                {/* Report Header */}
                <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                  <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">BLD Cebu</h3>
                    <h4 className="text-xl font-semibold text-gray-800 mb-1">{financialReport.event.title}</h4>
                    <p className="text-sm text-gray-600">
                      {formatDate(financialReport.event.startDate)} - {formatDate(financialReport.event.endDate)}
                    </p>
                    {currentUser && (
                      <p className="text-xs text-gray-500 mt-2">
                        Generated by: {currentUser.name} | {formatDate(financialReport.generatedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Financial Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Income</p>
                      <p className="text-xl font-bold text-green-700">
                        {formatCurrency(financialReport.summary.totalIncome)}
                      </p>
                      <p className="text-xs text-gray-500">{financialReport.summary.incomeCount} entries</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Expenses</p>
                      <p className="text-xl font-bold text-red-700">
                        {formatCurrency(financialReport.summary.totalExpenses)}
                      </p>
                      <p className="text-xs text-gray-500">{financialReport.summary.expenseCount} entries</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Adjustments</p>
                      <p className="text-xl font-bold text-purple-700">
                        {formatCurrency(financialReport.summary.totalAdjustments)}
                      </p>
                      <p className="text-xs text-gray-500">{financialReport.summary.adjustmentCount} entries</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Net Balance</p>
                      <p className={`text-xl font-bold ${financialReport.summary.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(financialReport.summary.netBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Profit Margin</p>
                      <p className="text-xl font-bold text-blue-700">
                        {financialReport.summary.profitMargin}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expense Ratio</p>
                      <p className="text-xl font-bold text-orange-700">
                        {financialReport.summary.expenseRatio}%
                      </p>
                    </div>
                  </div>

                  {/* Surplus/Deficit Indicator */}
                  <div className="mt-4 pt-4 border-t border-blue-300">
                    <div className={`text-center p-4 rounded-lg ${financialReport.summary.netBalance >= 0 ? 'bg-green-100 border-2 border-green-400' : 'bg-red-100 border-2 border-red-400'}`}>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Financial Status</p>
                      {financialReport.summary.netBalance >= 0 ? (
                        <p className="text-2xl font-bold text-green-800">
                          ✓ SURPLUS: {formatCurrency(financialReport.summary.netBalance)}
                        </p>
                      ) : (
                        <p className="text-2xl font-bold text-red-800">
                          ✗ DEFICIT: {formatCurrency(financialReport.summary.netBalance)}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-1">
                        {financialReport.summary.netBalance >= 0 
                          ? 'Income exceeds expenses' 
                          : 'Expenses exceed income'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Income Entries Table */}
                {financialReport.incomeEntries.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">Detailed Income Entries</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>OR/ Voucher No.</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financialReport.incomeEntries.map((entry, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                              <TableCell className="text-sm font-mono text-gray-600">
                                {entry.orNumber || '-'}
                              </TableCell>
                              <TableCell className="font-medium">{entry.description}</TableCell>
                              <TableCell>{entry.source || '-'}</TableCell>
                              <TableCell className="text-right font-semibold text-green-700">
                                {formatCurrency(entry.amount)}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">{entry.remarks || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Detailed Expense Entries Table */}
                {financialReport.expenseEntries.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">Detailed Expense Entries</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>OR/ Voucher No.</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financialReport.expenseEntries.map((entry, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                              <TableCell className="text-sm font-mono text-gray-600">
                                {entry.orNumber || '-'}
                              </TableCell>
                              <TableCell className="font-medium">{entry.description}</TableCell>
                              <TableCell>{entry.category || '-'}</TableCell>
                              <TableCell className="text-right font-semibold text-red-700">
                                {formatCurrency(entry.amount)}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">{entry.remarks || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Income by Source Summary */}
                {financialReport.incomeBySource.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">Income by Source Summary</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialReport.incomeBySource.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.source || 'Unspecified'}</TableCell>
                            <TableCell className="text-right font-semibold text-green-700">
                              {formatCurrency(item.total)}
                            </TableCell>
                            <TableCell className="text-right">{item.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Expenses by Category Summary */}
                {financialReport.expensesByCategory.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">Expenses by Category Summary</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialReport.expensesByCategory.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.category || 'Unspecified'}</TableCell>
                            <TableCell className="text-right font-semibold text-red-700">
                              {formatCurrency(item.total)}
                            </TableCell>
                            <TableCell className="text-right">{item.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Download Buttons */}
                <div className="flex gap-2 justify-center pt-4 border-t">
                  <Button
                    onClick={handleDownloadPDF}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={!financialReport || !event || !currentUser}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Download PDF Report
                  </Button>
                  <Button
                    onClick={handleDownloadReport}
                    variant="outline"
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV Report
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No report data available</p>
            )}
          </CardContent>
        </Card>

        {/* Income Dialog */}
        <Dialog open={showIncomeDialog} onOpenChange={setShowIncomeDialog}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>{editingIncome ? 'Edit money in' : 'Add money in'}</DialogTitle>
              <DialogDescription>
                {editingIncome
                  ? 'Update this line — totals and reports refresh automatically.'
                  : 'Record a payment or donation you received for this event.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="income-description">Description *</Label>
                <Input
                  id="income-description"
                  value={incomeForm.description}
                  onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  placeholder="e.g., Registration fees from participants"
                />
              </div>
              <div>
                <Label htmlFor="income-amount">Amount *</Label>
                <Input
                  id="income-amount"
                  type="number"
                  step="0.01"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="income-source">Source</Label>
                <Input
                  id="income-source"
                  value={incomeForm.source}
                  onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
                  placeholder="e.g., Registration Fees"
                />
              </div>
              <div>
                <Label htmlFor="income-remarks">Remarks (max 5 words)</Label>
                <Input
                  id="income-remarks"
                  value={incomeForm.remarks}
                  onChange={(e) => setIncomeForm({ ...incomeForm, remarks: e.target.value })}
                  placeholder="e.g., Payment received early"
                  maxLength={50}
                />
                {incomeForm.remarks && !validateWordCount(incomeForm.remarks, 5) && (
                  <p className="text-xs text-red-600 mt-1">
                    {incomeForm.remarks.trim().split(/\s+/).length} words (max 5 words)
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="income-or-voucher">OR/ Voucher No.</Label>
                <Input
                  id="income-or-voucher"
                  value={incomeForm.orVoucherNumber}
                  onChange={(e) => setIncomeForm({ ...incomeForm, orVoucherNumber: e.target.value })}
                  placeholder="e.g., OR-20240119-12345 (optional)"
                />
              </div>
              <div>
                <Label htmlFor="income-date">Date Received</Label>
                <Input
                  id="income-date"
                  type="date"
                  value={incomeForm.receivedAt}
                  onChange={(e) => setIncomeForm({ ...incomeForm, receivedAt: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowIncomeDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveIncome}>
                  {editingIncome ? 'Update' : 'Add'} Income
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Expense Dialog */}
        <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Edit expense' : 'Add expense'}</DialogTitle>
              <DialogDescription>
                {editingExpense
                  ? 'Update this cost — totals refresh automatically.'
                  : 'For costs you pay directly (not from a settled cash advance — those come from “Turn in receipts”).'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="expense-description">Description *</Label>
                <Input
                  id="expense-description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g., Venue rental fee"
                />
              </div>
              <div>
                <Label htmlFor="expense-amount">Amount *</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="expense-category">Category</Label>
                <Input
                  id="expense-category"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  placeholder="e.g., Venue, Food, Transportation"
                />
              </div>
              <div>
                <Label htmlFor="expense-remarks">Remarks (max 5 words)</Label>
                <Input
                  id="expense-remarks"
                  value={expenseForm.remarks}
                  onChange={(e) => setExpenseForm({ ...expenseForm, remarks: e.target.value })}
                  placeholder="e.g., Payment made early"
                  maxLength={50}
                />
                {expenseForm.remarks && !validateWordCount(expenseForm.remarks, 5) && (
                  <p className="text-xs text-red-600 mt-1">
                    {expenseForm.remarks.trim().split(/\s+/).length} words (max 5 words)
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="expense-or-voucher">OR/ Voucher No.</Label>
                <Input
                  id="expense-or-voucher"
                  value={expenseForm.orVoucherNumber}
                  onChange={(e) => setExpenseForm({ ...expenseForm, orVoucherNumber: e.target.value })}
                  placeholder="e.g., OR-20240119-12345 (optional)"
                />
              </div>
              <div>
                <Label htmlFor="expense-date">Date Paid</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={expenseForm.paidAt}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paidAt: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveExpense} variant="destructive">
                  {editingExpense ? 'Update' : 'Add'} Expense
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showCaDialog} onOpenChange={setShowCaDialog}>
          <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {editingCa ? 'Update cash release' : 'Record cash release'}
              </DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                This step only remembers that cash left your team. The “money spent” total updates later, when real receipts are added and finalized.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ca-amount">How much cash? (PHP) *</Label>
                <Input
                  id="ca-amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={caForm.amount}
                  onChange={(e) => setCaForm({ ...caForm, amount: e.target.value })}
                  className="mt-1.5 text-lg font-medium tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="ca-date">Date given</Label>
                <Input
                  id="ca-date"
                  type="date"
                  value={caForm.disbursedAt}
                  onChange={(e) => setCaForm({ ...caForm, disbursedAt: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="ca-payee">Who received it?</Label>
                <Input
                  id="ca-payee"
                  value={caForm.payeeName}
                  onChange={(e) => setCaForm({ ...caForm, payeeName: e.target.value })}
                  placeholder="Full name or team role"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="ca-ref">DV, check #, or other reference</Label>
                <Input
                  id="ca-ref"
                  value={caForm.referenceNumber}
                  onChange={(e) => setCaForm({ ...caForm, referenceNumber: e.target.value })}
                  placeholder="Optional but helpful for audit"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="ca-notes">Notes for your team</Label>
                <Textarea
                  id="ca-notes"
                  value={caForm.notation}
                  onChange={(e) => setCaForm({ ...caForm, notation: e.target.value })}
                  placeholder="Why this cash was released, deadlines, anything people should remember…"
                  rows={4}
                  className="mt-1.5 resize-y min-h-[100px]"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setShowCaDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCa} className="bg-amber-600 hover:bg-amber-700">
                  {editingCa ? 'Save changes' : 'Save cash release'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showLiquidationDialog}
          onOpenChange={(open) => {
            setShowLiquidationDialog(open);
            if (!open) setLiquidationTarget(null);
          }}
        >
          <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Turn in receipts</DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                {liquidationTarget && (
                  <>
                    Original cash out: <strong>{formatCurrency(liquidationTarget.amount)}</strong>
                    {liquidationTarget.referenceNumber ? (
                      <>
                        {' '}
                        · Ref <strong>{liquidationTarget.referenceNumber}</strong>
                      </>
                    ) : null}
                    . List each real purchase below. When you finalize, these become your official “spent” lines.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {liquidationTarget && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lr-notes">Notes on this packet (optional)</Label>
                  <Textarea
                    id="lr-notes"
                    value={liquidationNotation}
                    onChange={(e) => setLiquidationNotation(e.target.value)}
                    rows={2}
                    placeholder="e.g. Team meal + transport — all ORs attached"
                    className="mt-1.5"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Label>Receipt lines</Label>
                      <p className="text-xs text-gray-500 mt-0.5">One row per receipt. Add as many as you need.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLiquidationLines([
                          ...liquidationLines,
                          { description: '', amount: '', category: '', orVoucherNumber: '', paidAt: '' },
                        ])
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add row
                    </Button>
                  </div>
                  {liquidationLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="md:col-span-4">
                        <Label className="text-xs">What was paid for *</Label>
                        <Input
                          value={line.description}
                          onChange={(e) => {
                            const next = [...liquidationLines];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setLiquidationLines(next);
                          }}
                          placeholder="e.g. Venue rental"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Amount (PHP) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(e) => {
                            const next = [...liquidationLines];
                            next[idx] = { ...next[idx], amount: e.target.value };
                            setLiquidationLines(next);
                          }}
                          className="tabular-nums"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Type (optional)</Label>
                        <Input
                          value={line.category}
                          onChange={(e) => {
                            const next = [...liquidationLines];
                            next[idx] = { ...next[idx], category: e.target.value };
                            setLiquidationLines(next);
                          }}
                          placeholder="Food, venue…"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">OR / receipt #</Label>
                        <Input
                          value={line.orVoucherNumber}
                          onChange={(e) => {
                            const next = [...liquidationLines];
                            next[idx] = { ...next[idx], orVoucherNumber: e.target.value };
                            setLiquidationLines(next);
                          }}
                          placeholder="From official receipt"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Label className="text-xs">Receipt date</Label>
                        <Input
                          type="date"
                          value={line.paidAt}
                          onChange={(e) => {
                            const next = [...liquidationLines];
                            next[idx] = { ...next[idx], paidAt: e.target.value };
                            setLiquidationLines(next);
                          }}
                        />
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        {liquidationLines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => setLiquidationLines(liquidationLines.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!account.isClosed && (
                  <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <p className="text-xs text-amber-900/90 max-w-md">
                      <strong className="text-amber-950">Check amounts and ORs before finalizing.</strong> This cannot be undone from this screen like a normal expense row.
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button variant="outline" onClick={() => setShowLiquidationDialog(false)}>
                        Close
                      </Button>
                      <Button variant="secondary" onClick={handleSaveLiquidationDraft}>
                        Save progress
                      </Button>
                      {liquidationTarget.liquidation?.status === 'DRAFT' && liquidationTarget.liquidation.lines?.length ? (
                        <Button onClick={handleApproveLiquidation} className="bg-emerald-700 hover:bg-emerald-800">
                          Finalize &amp; record as expenses
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showMonitoredDialog} onOpenChange={setShowMonitoredDialog}>
          <DialogContent className="bg-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {editingMonitored ? 'Edit this note' : 'Note other cash out'}
              </DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                A simple reminder for your team. It does <strong>not</strong> change the red “money spent” total — add real expenses separately if they apply.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mon-amount">Amount (PHP) *</Label>
                <Input
                  id="mon-amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={monitoredForm.amount}
                  onChange={(e) => setMonitoredForm({ ...monitoredForm, amount: e.target.value })}
                  className="mt-1.5 tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="mon-date">Date</Label>
                <Input
                  id="mon-date"
                  type="date"
                  value={monitoredForm.disbursedAt}
                  onChange={(e) => setMonitoredForm({ ...monitoredForm, disbursedAt: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="mon-label">Short label</Label>
                <Input
                  id="mon-label"
                  value={monitoredForm.label}
                  onChange={(e) => setMonitoredForm({ ...monitoredForm, label: e.target.value })}
                  placeholder="e.g. Petty refill, Parking"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="mon-payee">Who was paid?</Label>
                <Input
                  id="mon-payee"
                  value={monitoredForm.payeeName}
                  onChange={(e) => setMonitoredForm({ ...monitoredForm, payeeName: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="mon-ref">Reference (optional)</Label>
                <Input
                  id="mon-ref"
                  value={monitoredForm.referenceNumber}
                  onChange={(e) => setMonitoredForm({ ...monitoredForm, referenceNumber: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="mon-notes">Notes</Label>
                <Textarea
                  id="mon-notes"
                  value={monitoredForm.notation}
                  onChange={(e) => setMonitoredForm({ ...monitoredForm, notation: e.target.value })}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setShowMonitoredDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveMonitored}>{editingMonitored ? 'Save changes' : 'Save note'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Adjustment Dialog */}
        <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Add a correction</DialogTitle>
              <DialogDescription>
                Use sparingly for approved fixes. Positive adds to what’s left; negative reduces it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="adjustment-description">Description *</Label>
                <Input
                  id="adjustment-description"
                  value={adjustmentForm.description}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, description: e.target.value })}
                  placeholder="e.g., Balance correction"
                />
              </div>
              <div>
                <Label htmlFor="adjustment-amount">Amount *</Label>
                <Input
                  id="adjustment-amount"
                  type="number"
                  step="0.01"
                  value={adjustmentForm.amount}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                  placeholder="0.00 (positive or negative)"
                />
              </div>
              <div>
                <Label htmlFor="adjustment-remarks">Remarks (max 5 words)</Label>
                <Input
                  id="adjustment-remarks"
                  value={adjustmentForm.remarks}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, remarks: e.target.value })}
                  placeholder="e.g., Correction for error"
                  maxLength={50}
                />
                {adjustmentForm.remarks && !validateWordCount(adjustmentForm.remarks, 5) && (
                  <p className="text-xs text-red-600 mt-1">
                    {adjustmentForm.remarks.trim().split(/\s+/).length} words (max 5 words)
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="adjustment-date">Date Adjusted</Label>
                <Input
                  id="adjustment-date"
                  type="date"
                  value={adjustmentForm.adjustedAt}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustedAt: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAdjustmentDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAdjustment}>
                  Add Adjustment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

