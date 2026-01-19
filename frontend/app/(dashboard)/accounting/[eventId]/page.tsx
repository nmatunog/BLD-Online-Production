'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, DollarSign, TrendingUp, TrendingDown, Lock, Unlock, Loader2 } from 'lucide-react';
import { accountingService, type EventAccount, type IncomeEntry, type ExpenseEntry } from '@/services/accounting.service';
import { eventsService, type Event } from '@/services/events.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';

export default function EventAccountingPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.eventId as string;

  const [account, setAccount] = useState<EventAccount | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);

  // Income form state
  const [incomeForm, setIncomeForm] = useState({
    description: '',
    amount: '',
    source: '',
    receivedAt: '',
  });

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: '',
    paidAt: '',
  });

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId]);

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

  const handleAddIncome = () => {
    setEditingIncome(null);
    setIncomeForm({
      description: '',
      amount: '',
      source: '',
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

    try {
      if (editingIncome) {
        await accountingService.updateIncomeEntry(eventId, editingIncome.id, {
          description: incomeForm.description,
          amount: parseFloat(incomeForm.amount),
          source: incomeForm.source || undefined,
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
          receivedAt: incomeForm.receivedAt ? new Date(incomeForm.receivedAt).toISOString() : undefined,
        });
        toast.success('Income Entry Added', {
          description: 'The income entry has been added successfully.',
        });
      }
      setShowIncomeDialog(false);
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save income entry';
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete income entry';
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

    try {
      if (editingExpense) {
        await accountingService.updateExpenseEntry(eventId, editingExpense.id, {
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category || undefined,
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
          paidAt: expenseForm.paidAt ? new Date(expenseForm.paidAt).toISOString() : undefined,
        });
        toast.success('Expense Entry Added', {
          description: 'The expense entry has been added successfully.',
        });
      }
      setShowExpenseDialog(false);
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save expense entry';
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete expense entry';
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to close account';
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to reopen account';
      toast.error('Error', {
        description: errorMessage,
      });
    }
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
                {formatCurrency(account.summary.totalIncome)}
              </p>
              <p className="text-xs text-green-700 mt-1">
                {account.summary.incomeCount} entries
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
                {formatCurrency(account.summary.totalExpenses)}
              </p>
              <p className="text-xs text-red-700 mt-1">
                {account.summary.expenseCount} entries
              </p>
            </CardContent>
          </Card>

          <Card className={`${account.summary.netBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Net Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${account.summary.netBalance >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                {formatCurrency(account.summary.netBalance)}
              </p>
              <p className={`text-xs mt-1 ${account.summary.netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {account.summary.netBalance >= 0 ? 'Profit' : 'Loss'}
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
            {account.incomeEntries.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No income entries yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {!account.isClosed && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.incomeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.receivedAt)}</TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>{entry.source || '-'}</TableCell>
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
            {account.expenseEntries.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No expense entries yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {!account.isClosed && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.expenseEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.paidAt)}</TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>{entry.category || '-'}</TableCell>
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
      </div>
    </div>
  );
}

