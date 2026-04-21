import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

/** Axios may omit `data` on some error/edge responses — never return undefined to callers. */
function ensureBody<T>(response: { data?: ApiResponse<T> }): ApiResponse<T> {
  const body = response?.data;
  if (body == null) {
    return { success: false, error: 'Empty response from server' };
  }
  return body;
}

export interface Event {
  id: string;
  title: string;
  eventType: string;
  category: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string;
  venue: string | null;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  cancellationReason: string | null;
  hasRegistration: boolean;
  registrationFee: number | null;
  maxParticipants: number | null;
  qrCodeUrl: string | null;
  isRecurring: boolean;
  recurrencePattern: string | null;
  recurrenceDays: string[];
  recurrenceInterval: number | null;
  monthlyType: string | null;
  monthlyDayOfMonth: number | null;
  monthlyWeekOfMonth: number | null;
  monthlyDayOfWeek: string | null;
  encounterType: string | null;
  classNumber: number | null;
  ministry: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    attendances: number;
    registrations: number;
  };
}

export interface EventQueryParams {
  search?: string;
  status?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  eventType?: string;
  category?: string;
  startDateFrom?: string;
  startDateTo?: string;
  sortBy?: 'startDate' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  /** Admin/Super User: include all ministry-specific events (e.g. all WSC). Default: general + user ministry only. */
  includeAllMinistryEvents?: boolean;
}

export interface CreateEventRequest {
  title: string;
  eventType: string;
  category: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location: string;
  venue?: string;
  status?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  hasRegistration?: boolean;
  registrationFee?: number;
  maxParticipants?: number;
  isRecurring?: boolean;
  recurrencePattern?: string;
  recurrenceDays?: string[];
  recurrenceInterval?: number;
  monthlyType?: string;
  monthlyDayOfMonth?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: string;
  encounterType?: string;
  classNumber?: number;
  ministry?: string;
}

export interface UpdateEventRequest extends Partial<CreateEventRequest> {}

class EventsService {
  async getAll(params?: EventQueryParams): Promise<ApiResponse<{ data: Event[]; pagination: unknown }>> {
    const response = await apiClient.get<ApiResponse<{ data: Event[]; pagination: unknown }>>('/events', {
      params,
    });
    return ensureBody(response);
  }

  async getUpcoming(): Promise<ApiResponse<Event[]>> {
    const response = await apiClient.get<ApiResponse<Event[]>>('/events/upcoming');
    return ensureBody(response);
  }

  async getById(id: string): Promise<ApiResponse<Event>> {
    const response = await apiClient.get<ApiResponse<Event>>(`/events/${id}`);
    return ensureBody(response);
  }

  async create(data: CreateEventRequest): Promise<ApiResponse<Event>> {
    const response = await apiClient.post<ApiResponse<Event>>('/events', data, { timeout: 30000 });
    return ensureBody(response);
  }

  async update(id: string, data: UpdateEventRequest): Promise<ApiResponse<Event>> {
    const response = await apiClient.put<ApiResponse<Event>>(`/events/${id}`, data);
    return ensureBody(response);
  }

  async delete(id: string): Promise<ApiResponse<unknown>> {
    const response = await apiClient.delete<ApiResponse<unknown>>(`/events/${id}`);
    return ensureBody(response);
  }

  async regenerateQRCode(id: string): Promise<ApiResponse<{ qrCodeUrl: string }>> {
    const response = await apiClient.post<ApiResponse<{ qrCodeUrl: string }>>(`/events/${id}/qr-code/regenerate`);
    return ensureBody(response);
  }

  async updateStatuses(): Promise<ApiResponse<unknown>> {
    const response = await apiClient.post<ApiResponse<unknown>>('/events/status/update');
    return ensureBody(response);
  }

  async cancel(id: string, cancellationReason?: string): Promise<ApiResponse<Event>> {
    const response = await apiClient.post<ApiResponse<Event>>(`/events/${id}/cancel`, {
      cancellationReason: cancellationReason || undefined,
    });
    return ensureBody(response);
  }

  /** Super User only: get all events (recurring + non-recurring) with creator info */
  async getAllForSuperUser(): Promise<ApiResponse<{ data: EventWithCreator[] }>> {
    const response = await apiClient.get<ApiResponse<{ data: EventWithCreator[] }>>('/events/super/all');
    return ensureBody(response);
  }

  /** Super User only: get event audit log */
  async getAuditLog(limit = 50, offset = 0): Promise<ApiResponse<EventAuditLogResponse>> {
    const response = await apiClient.get<ApiResponse<EventAuditLogResponse>>('/events/super/audit-log', {
      params: { limit, offset },
    });
    return ensureBody(response);
  }

  /** Super User only: revert an event deletion or edit */
  async revertAuditEntry(auditLogId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      `/events/super/audit-log/${auditLogId}/revert`,
    );
    return ensureBody(response);
  }

  /** Super User only: find duplicate events for cleanup */
  async findDuplicates(): Promise<ApiResponse<{ groups: DuplicateGroup[] }>> {
    const response = await apiClient.get<ApiResponse<{ groups: DuplicateGroup[] }>>('/events/super/duplicates');
    return ensureBody(response);
  }

  /** Super User only: correct all duplicates – keep one per group, merge check-ins, remove the rest */
  async correctAllDuplicates(): Promise<
    ApiResponse<{ groupsProcessed: number; eventsRemoved: number; attendancesMerged: number }>
  > {
    const response = await apiClient.post<
      ApiResponse<{ groupsProcessed: number; eventsRemoved: number; attendancesMerged: number }>
    >('/events/super/duplicates/correct-all', undefined, { timeout: 18000 * 1000 });
    return ensureBody(response);
  }
}

export interface EventAuditLogEntry {
  id: string;
  eventId: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId: string;
  userEmail: string | null;
  performedAt: string;
  previousSnapshot: Record<string, unknown> | null;
  changedFields: Record<string, { old: unknown; new: unknown }> | null;
  restoredAt: string | null;
  restoredBy: string | null;
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    member?: { firstName: string; lastName: string; nickname: string | null } | null;
  };
}

export interface EventAuditLogResponse {
  data: EventAuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface DuplicateGroup {
  keys: string;
  events: Array<{
    id: string;
    title: string;
    category: string;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    location: string;
    isRecurring: boolean;
    recurrenceTemplateId: string | null;
    createdAt: string;
    createdBy?: { id: string; email: string | null; phone: string | null; member?: { firstName: string; lastName: string } | null };
  }>;
}

export interface EventWithCreator extends Event {
  createdBy?: {
    id: string;
    email: string | null;
    phone: string | null;
    member?: { firstName: string; lastName: string; nickname: string | null } | null;
  } | null;
}

export const eventsService = new EventsService();

