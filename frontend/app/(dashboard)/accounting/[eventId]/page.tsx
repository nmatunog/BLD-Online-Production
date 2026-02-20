'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, DollarSign, TrendingUp, TrendingDown, Lock, Unlock, Loader2, Download, FileText } from 'lucide-react';
import { accountingService, type EventAccount, type IncomeEntry, type ExpenseEntry, type AdjustmentEntry, type FinancialReport } from '@/services/accounting.service';
import { eventsService, type Event } from '@/services/events.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        </div>
      </div>
    );
  }

  if (!account || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">Event not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
              <p className="text-gray-600 mt-1">Event Accounting</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDownloadReport}
                variant="outline"
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                className="text-purple-600 border-purple-600 hover:bg-purple-50"
                disabled={!financialReport || !event || !currentUser}
              >
                <FileText className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              {account.isClosed ? (
                <Button
                  onClick={handleReopenAccount}
                  variant="outline"
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Reopen Account
                </Button>
              ) : (
                <Button
                  onClick={handleCloseAccount}
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Close Account
                </Button>
              )}
            </div>
          </div>
          {account.isClosed && (
            <Badge className="mt-2 bg-red-100 text-red-800 border-red-300">
              Account Closed
            </Badge>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-800 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(account.summary?.totalIncome || 0)}
              </p>
              <p className="text-xs text-green-700 mt-1">
                {account.summary?.incomeCount || 0} entries
              </p>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-800 flex items-center">
                <TrendingDown className="w-4 h-4 mr-2" />
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-900">
                {formatCurrency(account.summary?.totalExpenses || 0)}
              </p>
              <p className="text-xs text-red-700 mt-1">
                {account.summary?.expenseCount || 0} entries
              </p>
            </CardContent>
          </Card>

          <Card className={`${(account.summary?.netBalance || 0) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Net Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(account.summary?.netBalance || 0) >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                {formatCurrency(account.summary?.netBalance || 0)}
              </p>
              <p className={`text-xs mt-1 ${(account.summary?.netBalance || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {(account.summary?.netBalance || 0) >= 0 ? 'Profit' : 'Loss'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Income Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">Income Entries</CardTitle>
              {!account.isClosed && (
                <Button onClick={handleAddIncome} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Income
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(!account.incomeEntries || account.incomeEntries.length === 0) ? (
              <p className="text-center text-gray-500 py-8">No income entries yet</p>
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

        {/* Expense Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">Expense Entries</CardTitle>
              {!account.isClosed && (
                <Button onClick={handleAddExpense} size="sm" variant="destructive">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(!account.expenseEntries || account.expenseEntries.length === 0) ? (
              <p className="text-center text-gray-500 py-8">No expense entries yet</p>
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
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>{entry.category || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{limitWords(entry.remarks)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      {!account.isClosed && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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

        {/* Adjustment Entries Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">Adjustment Entries</CardTitle>
              {!account.isClosed && (
                <Button onClick={handleAddAdjustment} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Adjustment
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(!account.adjustmentEntries || account.adjustmentEntries.length === 0) ? (
              <p className="text-center text-gray-500 py-8">No adjustment entries yet</p>
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">Financial Report Summary</CardTitle>
              {reportLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="ml-2 text-gray-600">Generating report...</span>
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
              <DialogTitle>{editingIncome ? 'Edit Income Entry' : 'Add Income Entry'}</DialogTitle>
              <DialogDescription>
                {editingIncome ? 'Update the income entry details' : 'Add a new income entry to the account'}
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
              <DialogTitle>{editingExpense ? 'Edit Expense Entry' : 'Add Expense Entry'}</DialogTitle>
              <DialogDescription>
                {editingExpense ? 'Update the expense entry details' : 'Add a new expense entry to the account'}
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

        {/* Adjustment Dialog */}
        <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Add Adjustment Entry</DialogTitle>
              <DialogDescription>
                Add a balance adjustment entry (positive or negative amount)
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

