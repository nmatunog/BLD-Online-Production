import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

export interface EventRegistration {
  id: string;
  eventId: string;
  memberId?: string | null;
  registrationType: 'MEMBER' | 'NON_MEMBER' | 'COUPLE';
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  spouseFirstName?: string | null;
  spouseLastName?: string | null;
  spouseMiddleName?: string | null;
  coupleRegistrationId?: string | null;
  coupleRole?: string | null;
  specialRequirements?: string | null;
  emergencyContact?: string | null;
  memberCommunityId?: string | null;
  roomAssignment?: string | null;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED';
  paymentAmount?: number | null;
  paymentReference?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  member?: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    nickname?: string | null;
    communityId: string;
    city: string;
    encounterType: string;
    classNumber: number;
    user?: {
      id: string;
      email: string | null;
      phone: string | null;
      role: string;
    };
  } | null;
  event?: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    registrationFee?: number | null;
  } | null;
}

export interface RegisterMemberRequest {
  memberCommunityId: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  nickname?: string;
  specialRequirements?: string;
  emergencyContact?: string;
  coupleRegistrationId?: string;
  coupleRole?: string;
}

export interface RegisterNonMemberRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  nameSuffix?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  specialRequirements?: string;
  city?: string;
  encounterType?: string;
  classNumber?: string;
  apostolate?: string;
  ministry?: string;
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseMiddleName?: string;
  spouseNameSuffix?: string;
  spouseNickname?: string;
  spouseEmail?: string;
  spousePhone?: string;
  spouseCity?: string;
  spouseEncounterType?: string;
  spouseClassNumber?: string;
  coupleRegistrationId?: string;
  coupleRole?: string;
}

export interface RegisterCoupleRequest {
  husbandCommunityId: string;
  husbandLastName: string;
  husbandFirstName: string;
  husbandMiddleName?: string;
  husbandNickname?: string;
  wifeCommunityId: string;
  wifeLastName: string;
  wifeFirstName: string;
  wifeMiddleName?: string;
  wifeNickname?: string;
  specialRequirements?: string;
  emergencyContact?: string;
}

export interface UpdateRegistrationRequest {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  specialRequirements?: string;
  emergencyContact?: string;
  notes?: string;
}

export interface UpdatePaymentStatusRequest {
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED';
  paymentAmount?: number;
  paymentReference?: string;
  notes?: string;
}

export interface UpdateRoomAssignmentRequest {
  roomAssignment: string;
}

export interface RegistrationQueryParams {
  search?: string;
  registrationType?: 'MEMBER' | 'NON_MEMBER' | 'COUPLE';
  paymentStatus?: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED';
  roomAssignment?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface RegistrationSummary {
  event: {
    id: string;
    title: string;
    maxParticipants?: number | null;
    registrationFee?: number | null;
    encounterType?: string | null;
    classNumber?: number | null;
  };
  summary: {
    totalRegistrations: number;
    memberRegistrations: number;
    nonMemberRegistrations: number;
    coupleRegistrations: number;
    pendingPayments: number;
    paidPayments: number;
    totalRevenue: number;
    capacityUsed?: number | null;
  };
}

export interface EventCandidate {
  id: string;
  eventId: string;
  classGroup?: string | null;
  classShepherds?: string | null;
  candidateClass: string;
  familyName: string;
  firstName: string;
  mobileNumber?: string | null;
  cleanMobile?: string | null;
  cmpATaken?: string | null;
  status: 'IMPORTED' | 'CLAIMED' | 'REGISTERED' | 'REJECTED';
  claimedAt?: string | null;
  registeredAt?: string | null;
  memberId?: string | null;
  registrationId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateSummary {
  total: number;
  imported: number;
  claimed: number;
  registered: number;
  rejected: number;
}

class RegistrationsService {
  async importCandidatesCsv(
    eventId: string,
    file: File,
    options?: { dryRun?: boolean },
  ): Promise<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/registrations/events/${eventId}/candidates/import-csv`,
      formData,
      {
        params: { dryRun: Boolean(options?.dryRun) },
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  }

  async listCandidates(
    eventId: string,
    params?: { search?: string; status?: 'IMPORTED' | 'CLAIMED' | 'REGISTERED' | 'REJECTED' },
  ): Promise<ApiResponse<EventCandidate[]>> {
    const response = await apiClient.get<ApiResponse<EventCandidate[]>>(
      `/registrations/events/${eventId}/candidates`,
      { params },
    );
    return response.data;
  }

  async getCandidateSummary(eventId: string): Promise<ApiResponse<CandidateSummary>> {
    const response = await apiClient.get<ApiResponse<CandidateSummary>>(
      `/registrations/events/${eventId}/candidates/summary`,
    );
    return response.data;
  }

  async claimCandidate(
    eventId: string,
    data: {
      candidateClass: string;
      familyName: string;
      firstName: string;
      mobileNumber?: string;
      email?: string;
    },
  ): Promise<
    ApiResponse<{
      candidateId: string;
      memberId: string;
      communityId: string;
      registrationId: string;
      generatedCommunityId?: string | null;
      userCreated: boolean;
      tempPassword?: string | null;
    }>
  > {
    const response = await apiClient.post<
      ApiResponse<{
        candidateId: string;
        memberId: string;
        communityId: string;
        registrationId: string;
        generatedCommunityId?: string | null;
        userCreated: boolean;
        tempPassword?: string | null;
      }>
    >(`/registrations/events/${eventId}/candidates/claim`, data);
    return response.data;
  }

  async registerMember(
    eventId: string,
    data: RegisterMemberRequest,
  ): Promise<ApiResponse<EventRegistration>> {
    const response = await apiClient.post<ApiResponse<EventRegistration>>(
      `/registrations/events/${eventId}/members`,
      data,
    );
    return response.data;
  }

  async registerNonMember(
    eventId: string,
    data: RegisterNonMemberRequest,
  ): Promise<ApiResponse<EventRegistration>> {
    const response = await apiClient.post<ApiResponse<EventRegistration>>(
      `/registrations/events/${eventId}/non-members`,
      data,
    );
    return response.data;
  }

  async registerCouple(
    eventId: string,
    data: RegisterCoupleRequest,
  ): Promise<ApiResponse<{ husband: EventRegistration; wife: EventRegistration; coupleRegistrationId: string }>> {
    const response = await apiClient.post<ApiResponse<{ husband: EventRegistration; wife: EventRegistration; coupleRegistrationId: string }>>(
      `/registrations/events/${eventId}/couples`,
      data,
    );
    return response.data;
  }

  async getRegistrations(
    eventId: string,
    params?: RegistrationQueryParams,
  ): Promise<ApiResponse<{ data: EventRegistration[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
    const response = await apiClient.get<ApiResponse<{ data: EventRegistration[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>>(
      `/registrations/events/${eventId}/registrations`,
      { params },
    );
    return response.data;
  }

  async getSummary(eventId: string): Promise<ApiResponse<RegistrationSummary>> {
    const response = await apiClient.get<ApiResponse<RegistrationSummary>>(
      `/registrations/events/${eventId}/summary`,
    );
    return response.data;
  }

  async getRegistrationsWithSummary(
    eventId: string,
    params?: RegistrationQueryParams,
  ): Promise<
    ApiResponse<{
      data: EventRegistration[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
      summary: RegistrationSummary;
    }>
  > {
    const response = await apiClient.get<
      ApiResponse<{
        data: EventRegistration[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
        summary: RegistrationSummary;
      }>
    >(`/registrations/events/${eventId}/registrations-and-summary`, { params });
    return response.data;
  }

  async getById(id: string): Promise<ApiResponse<EventRegistration>> {
    const response = await apiClient.get<ApiResponse<EventRegistration>>(
      `/registrations/${id}`,
    );
    return response.data;
  }

  async update(
    id: string,
    data: UpdateRegistrationRequest,
  ): Promise<ApiResponse<EventRegistration>> {
    const response = await apiClient.put<ApiResponse<EventRegistration>>(
      `/registrations/${id}`,
      data,
    );
    return response.data;
  }

  async updatePaymentStatus(
    id: string,
    data: UpdatePaymentStatusRequest,
  ): Promise<ApiResponse<EventRegistration>> {
    const response = await apiClient.put<ApiResponse<EventRegistration>>(
      `/registrations/${id}/payment`,
      data,
    );
    return response.data;
  }

  async updateRoomAssignment(
    id: string,
    data: UpdateRoomAssignmentRequest,
  ): Promise<ApiResponse<EventRegistration>> {
    const response = await apiClient.put<ApiResponse<EventRegistration>>(
      `/registrations/${id}/room`,
      data,
    );
    return response.data;
  }

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/registrations/${id}`,
    );
    return response.data;
  }
}

export const registrationsService = new RegistrationsService();

