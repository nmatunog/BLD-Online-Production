import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

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
    return response.data;
  }

  async getUpcoming(): Promise<ApiResponse<Event[]>> {
    const response = await apiClient.get<ApiResponse<Event[]>>('/events/upcoming');
    return response.data;
  }

  async getById(id: string): Promise<ApiResponse<Event>> {
    const response = await apiClient.get<ApiResponse<Event>>(`/events/${id}`);
    return response.data;
  }

  async create(data: CreateEventRequest): Promise<ApiResponse<Event>> {
    const response = await apiClient.post<ApiResponse<Event>>('/events', data);
    return response.data;
  }

  async update(id: string, data: UpdateEventRequest): Promise<ApiResponse<Event>> {
    const response = await apiClient.put<ApiResponse<Event>>(`/events/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<ApiResponse<unknown>> {
    const response = await apiClient.delete<ApiResponse<unknown>>(`/events/${id}`);
    return response.data;
  }

  async regenerateQRCode(id: string): Promise<ApiResponse<{ qrCodeUrl: string }>> {
    const response = await apiClient.post<ApiResponse<{ qrCodeUrl: string }>>(`/events/${id}/qr-code/regenerate`);
    return response.data;
  }

  async updateStatuses(): Promise<ApiResponse<unknown>> {
    const response = await apiClient.post<ApiResponse<unknown>>('/events/status/update');
    return response.data;
  }

  async cancel(id: string, cancellationReason?: string): Promise<ApiResponse<Event>> {
    const response = await apiClient.post<ApiResponse<Event>>(`/events/${id}/cancel`, {
      cancellationReason: cancellationReason || undefined,
    });
    return response.data;
  }
}

export const eventsService = new EventsService();

