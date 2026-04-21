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
  liquidationLineId?: string | null;
}

export interface LiquidationLine {
  id: string;
  liquidationId: string;
  description: string;
  amount: number;
  category: string | null;
  orVoucherNumber: string | null;
  paidAt: string | null;
}

export interface Liquidation {
  id: string;
  cashAdvanceId: string;
  status: 'DRAFT' | 'APPROVED';
  notation: string | null;
  approvedAt: string | null;
  lines: LiquidationLine[];
}

export type CashReleaseType =
  | 'CASH_ADVANCE'
  | 'REIMBURSEMENT'
  | 'PURCHASE'
  | 'PETTY_CASH'
  | 'SUPPLIES'
  | 'HONORARIUM'
  | 'TRANSPORT'
  | 'OTHER';

export interface CashAdvance {
  id: string;
  accountId: string;
  amount: number;
  disbursedAt: string;
  releaseType: CashReleaseType;
  payeeName: string | null;
  referenceNumber: string | null;
  notation: string | null;
  status: 'OUTSTANDING' | 'LIQUIDATED';
  liquidation: Liquidation | null;
}

export interface MonitoredDisbursement {
  id: string;
  accountId: string;
  label: string | null;
  amount: number;
  disbursedAt: string;
  releaseType: CashReleaseType;
  payeeName: string | null;
  referenceNumber: string | null;
  notation: string | null;
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
  cashAdvances?: CashAdvance[];
  monitoredDisbursements?: MonitoredDisbursement[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalAdjustments?: number;
    netBalance: number;
    incomeCount: number;
    expenseCount: number;
    adjustmentCount?: number;
    totalCashAdvanceDisbursed?: number;
    totalMonitoredDisbursement?: number;
    totalTrackedCashDisbursement?: number;
    outstandingCashAdvanceCount?: number;
    outstandingCashAdvanceAmount?: number;
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

export interface CreateCashAdvanceRequest {
  amount: number;
  disbursedAt?: string;
  releaseType?: CashReleaseType;
  payeeName?: string;
  referenceNumber?: string;
  notation?: string;
}

export interface UpdateCashAdvanceRequest {
  amount?: number;
  disbursedAt?: string;
  releaseType?: CashReleaseType;
  payeeName?: string;
  referenceNumber?: string;
  notation?: string;
}

export interface LiquidationLineInput {
  description: string;
  amount: number;
  category?: string;
  orVoucherNumber?: string;
  paidAt?: string;
}

export interface SaveLiquidationRequest {
  notation?: string;
  lines: LiquidationLineInput[];
}

export interface CreateMonitoredDisbursementRequest {
  amount: number;
  disbursedAt?: string;
  releaseType?: CashReleaseType;
  label?: string;
  payeeName?: string;
  referenceNumber?: string;
  notation?: string;
}

export interface UpdateMonitoredDisbursementRequest {
  amount?: number;
  disbursedAt?: string;
  releaseType?: CashReleaseType;
  label?: string;
  payeeName?: string;
  referenceNumber?: string;
  notation?: string;
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

  async createCashAdvance(
    eventId: string,
    data: CreateCashAdvanceRequest,
  ): Promise<ApiResponse<CashAdvance>> {
    const response = await apiClient.post<ApiResponse<CashAdvance>>(
      `/accounting/events/${eventId}/cash-advances`,
      data,
    );
    return response.data;
  }

  async updateCashAdvance(
    eventId: string,
    cashAdvanceId: string,
    data: UpdateCashAdvanceRequest,
  ): Promise<ApiResponse<CashAdvance>> {
    const response = await apiClient.patch<ApiResponse<CashAdvance>>(
      `/accounting/events/${eventId}/cash-advances/${cashAdvanceId}`,
      data,
    );
    return response.data;
  }

  async deleteCashAdvance(
    eventId: string,
    cashAdvanceId: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
      `/accounting/events/${eventId}/cash-advances/${cashAdvanceId}`,
    );
    return response.data;
  }

  async saveLiquidationDraft(
    eventId: string,
    cashAdvanceId: string,
    data: SaveLiquidationRequest,
  ): Promise<ApiResponse<Liquidation>> {
    const response = await apiClient.put<ApiResponse<Liquidation>>(
      `/accounting/events/${eventId}/cash-advances/${cashAdvanceId}/liquidation`,
      data,
    );
    return response.data;
  }

  async approveLiquidation(
    eventId: string,
    liquidationId: string,
  ): Promise<ApiResponse<Liquidation>> {
    const response = await apiClient.post<ApiResponse<Liquidation>>(
      `/accounting/events/${eventId}/liquidations/${liquidationId}/approve`,
    );
    return response.data;
  }

  async createMonitoredDisbursement(
    eventId: string,
    data: CreateMonitoredDisbursementRequest,
  ): Promise<ApiResponse<MonitoredDisbursement>> {
    const response = await apiClient.post<ApiResponse<MonitoredDisbursement>>(
      `/accounting/events/${eventId}/monitored-disbursements`,
      data,
    );
    return response.data;
  }

  async updateMonitoredDisbursement(
    eventId: string,
    id: string,
    data: UpdateMonitoredDisbursementRequest,
  ): Promise<ApiResponse<MonitoredDisbursement>> {
    const response = await apiClient.patch<ApiResponse<MonitoredDisbursement>>(
      `/accounting/events/${eventId}/monitored-disbursements/${id}`,
      data,
    );
    return response.data;
  }

  async deleteMonitoredDisbursement(
    eventId: string,
    id: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
      `/accounting/events/${eventId}/monitored-disbursements/${id}`,
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
    fromLiquidation?: boolean;
  }>;
  cashAdvances?: Array<{
    id: string;
    amount: number;
    disbursedAt: string;
    releaseType?: CashReleaseType;
    payeeName: string | null;
    referenceNumber: string | null;
    notation: string | null;
    status: string;
    liquidation: {
      id: string;
      status: string;
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
    } | null;
  }>;
  monitoredDisbursements?: Array<{
    id: string;
    label: string | null;
    amount: number;
    disbursedAt: string;
    releaseType?: CashReleaseType;
    payeeName: string | null;
    referenceNumber: string | null;
    notation: string | null;
  }>;
  cashMonitoringSummary?: {
    totalCashAdvanceDisbursed: number;
    totalMonitoredDisbursement: number;
    totalTrackedCashDisbursement: number;
    outstandingCashAdvanceCount: number;
    outstandingCashAdvanceAmount: number;
  };
  adjustmentEntries: Array<{
    date: string;
    description: string;
    amount: number;
    remarks: string;
  }>;
  generatedAt: string;
}

export const accountingService = new AccountingService();






