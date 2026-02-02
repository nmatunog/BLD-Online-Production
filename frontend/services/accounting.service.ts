import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

export interface IncomeEntry {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  source: string | null;
  remarks: string | null;
  orVoucherNumber: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdjustmentEntry {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  remarks: string | null;
  orVoucherNumber: string | null;
  adjustedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseEntry {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  category: string | null;
  remarks: string | null;
  orVoucherNumber: string | null;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventAccount {
  id: string;
  eventId: string;
  isClosed: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  adjustmentEntries: AdjustmentEntry[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    incomeCount: number;
    expenseCount: number;
  };
}

export interface CreateIncomeEntryRequest {
  description: string;
  amount: number;
  source?: string;
  remarks?: string;
  orVoucherNumber?: string;
  receivedAt?: string;
}

export interface CreateAdjustmentEntryRequest {
  description: string;
  amount: number;
  remarks?: string;
  orVoucherNumber?: string;
  adjustedAt?: string;
}

export interface CreateExpenseEntryRequest {
  description: string;
  amount: number;
  category?: string;
  remarks?: string;
  orVoucherNumber?: string;
  paidAt?: string;
}

export interface UpdateIncomeEntryRequest {
  description?: string;
  amount?: number;
  source?: string;
  remarks?: string;
  orVoucherNumber?: string;
  receivedAt?: string;
}

export interface UpdateExpenseEntryRequest {
  description?: string;
  amount?: number;
  category?: string;
  remarks?: string;
  orVoucherNumber?: string;
  paidAt?: string;
}

export class AccountingService {
  async getEventAccount(eventId: string): Promise<ApiResponse<EventAccount>> {
    const response = await apiClient.get<ApiResponse<EventAccount>>(
      `/accounting/events/${eventId}`,
    );
    return response.data;
  }

  async createIncomeEntry(
    eventId: string,
    data: CreateIncomeEntryRequest,
  ): Promise<ApiResponse<IncomeEntry>> {
    const response = await apiClient.post<ApiResponse<IncomeEntry>>(
      `/accounting/events/${eventId}/income`,
      data,
    );
    return response.data;
  }

  async createExpenseEntry(
    eventId: string,
    data: CreateExpenseEntryRequest,
  ): Promise<ApiResponse<ExpenseEntry>> {
    const response = await apiClient.post<ApiResponse<ExpenseEntry>>(
      `/accounting/events/${eventId}/expenses`,
      data,
    );
    return response.data;
  }

  async updateIncomeEntry(
    eventId: string,
    entryId: string,
    data: UpdateIncomeEntryRequest,
  ): Promise<ApiResponse<IncomeEntry>> {
    const response = await apiClient.put<ApiResponse<IncomeEntry>>(
      `/accounting/events/${eventId}/income/${entryId}`,
      data,
    );
    return response.data;
  }

  async updateExpenseEntry(
    eventId: string,
    entryId: string,
    data: UpdateExpenseEntryRequest,
  ): Promise<ApiResponse<ExpenseEntry>> {
    const response = await apiClient.put<ApiResponse<ExpenseEntry>>(
      `/accounting/events/${eventId}/expenses/${entryId}`,
      data,
    );
    return response.data;
  }

  async deleteIncomeEntry(
    eventId: string,
    entryId: string,
  ): Promise<ApiResponse<unknown>> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/accounting/events/${eventId}/income/${entryId}`,
    );
    return response.data;
  }

  async deleteExpenseEntry(
    eventId: string,
    entryId: string,
  ): Promise<ApiResponse<unknown>> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/accounting/events/${eventId}/expenses/${entryId}`,
    );
    return response.data;
  }

  async closeEventAccount(eventId: string): Promise<ApiResponse<EventAccount>> {
    const response = await apiClient.post<ApiResponse<EventAccount>>(
      `/accounting/events/${eventId}/close`,
    );
    return response.data;
  }

  async reopenEventAccount(eventId: string): Promise<ApiResponse<EventAccount>> {
    const response = await apiClient.post<ApiResponse<EventAccount>>(
      `/accounting/events/${eventId}/reopen`,
    );
    return response.data;
  }

  async createAdjustmentEntry(
    eventId: string,
    data: CreateAdjustmentEntryRequest,
  ): Promise<ApiResponse<AdjustmentEntry>> {
    const response = await apiClient.post<ApiResponse<AdjustmentEntry>>(
      `/accounting/events/${eventId}/adjustments`,
      data,
    );
    return response.data;
  }

  async deleteAdjustmentEntry(
    eventId: string,
    entryId: string,
  ): Promise<ApiResponse<unknown>> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/accounting/events/${eventId}/adjustments/${entryId}`,
    );
    return response.data;
  }

  async generateFinancialReport(eventId: string): Promise<ApiResponse<FinancialReport>> {
    const response = await apiClient.get<ApiResponse<FinancialReport>>(
      `/accounting/events/${eventId}/report`,
    );
    return response.data;
  }
}

export interface FinancialReport {
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    location: string;
    venue: string | null;
    status: string;
  };
  account: {
    id: string;
    isClosed: boolean;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalAdjustments: number;
    netBalance: number;
    incomeCount: number;
    expenseCount: number;
    adjustmentCount: number;
    profitMargin: string;
    expenseRatio: string;
  };
  incomeBySource: Array<{
    source: string;
    total: number;
    count: number;
    entries: Array<{
      date: string;
      description: string;
      amount: number;
      remarks: string;
    }>;
  }>;
  expensesByCategory: Array<{
    category: string;
    total: number;
    count: number;
    entries: Array<{
      date: string;
      description: string;
      amount: number;
      remarks: string;
    }>;
  }>;
  incomeEntries: Array<{
    date: string;
    description: string;
    source: string;
    amount: number;
    remarks: string;
    orNumber: string;
    registrationId?: string | null;
  }>;
  expenseEntries: Array<{
    date: string;
    description: string;
    category: string;
    amount: number;
    remarks: string;
    orNumber: string;
  }>;
  adjustmentEntries: Array<{
    date: string;
    description: string;
    amount: number;
    remarks: string;
  }>;
  generatedAt: string;
}

export const accountingService = new AccountingService();






