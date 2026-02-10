import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

export interface Member {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
  nickname?: string | null;
  communityId: string;
  city: string;
  encounterType: string;
  classNumber: number;
  apostolate?: string | null;
  ministry?: string | null;
  serviceArea?: string | null;
  photoUrl?: string | null;
  qrCodeUrl?: string | null;
  gender?: string | null;
  profession?: string | null;
  civilStatus?: string | null;
  dateOfBirth?: string | null;
  spouseName?: string | null;
  dateOfMarriage?: string | null;
  numberOfChildren?: number | null;
  children?: Array<{ name?: string; gender?: string; dateOfBirth?: string }> | null;
  dateOfEncounter?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    isActive: boolean;
    shepherdEncounterType?: string | null;
    shepherdClassNumber?: number | null;
    ministry?: string | null;
  };
}

export interface MemberQueryParams {
  search?: string;
  city?: string;
  encounterType?: string;
  ministry?: string;
  apostolate?: string;
  sortBy?: 'name' | 'communityId' | 'city' | 'encounterType' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MembersResponse {
  data: Member[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateMemberRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  nickname?: string;
  city: string;
  encounterType: string;
  classNumber: string;
  email?: string;
  phone?: string;
  apostolate?: string;
  ministry?: string;
  serviceArea?: string;
}

export interface UpdateMemberRequest {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  nickname?: string;
  communityId?: string;
  city?: string;
  encounterType?: string;
  classNumber?: string;
  apostolate?: string;
  ministry?: string;
  serviceArea?: string;
  photoUrl?: string;
  gender?: string;
  profession?: string;
  civilStatus?: string;
  dateOfBirth?: string;
  spouseName?: string;
  dateOfMarriage?: string;
  numberOfChildren?: number;
  children?: Array<{ name?: string; gender?: string; dateOfBirth?: string }>;
  dateOfEncounter?: string;
}

class MembersService {
  async getAll(params?: MemberQueryParams): Promise<MembersResponse> {
    const response = await apiClient.get<ApiResponse<MembersResponse>>('/members', {
      params,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch members');
    }
    return response.data.data;
  }

  async getById(id: string): Promise<Member> {
    const response = await apiClient.get<ApiResponse<Member>>(`/members/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch member');
    }
    return response.data.data;
  }

  async getByCommunityId(communityId: string): Promise<Member> {
    const response = await apiClient.get<ApiResponse<Member>>(
      `/members/community/${communityId}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch member');
    }
    return response.data.data;
  }

  async getMe(): Promise<Member> {
    const response = await apiClient.get<ApiResponse<Member>>('/members/me');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch member profile');
    }
    return response.data.data;
  }

  async create(data: CreateMemberRequest): Promise<Member> {
    const response = await apiClient.post<ApiResponse<Member>>('/members', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create member');
    }
    return response.data.data;
  }

  async update(id: string, data: UpdateMemberRequest): Promise<Member> {
    const response = await apiClient.put<ApiResponse<Member>>(`/members/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update member');
    }
    return response.data.data;
  }

  async updateMe(data: UpdateMemberRequest): Promise<Member> {
    const response = await apiClient.put<ApiResponse<Member>>('/members/me', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update member profile');
    }
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<unknown>>(`/members/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete member');
    }
  }

  /** Permanently remove a deactivated member and account. Account must be deactivated first. */
  async deletePermanent(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<unknown>>(`/members/${id}/permanent`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to permanently remove member');
    }
  }

  async regenerateQRCode(id: string): Promise<{ id: string; communityId: string; qrCodeUrl: string }> {
    const response = await apiClient.post<ApiResponse<{ id: string; communityId: string; qrCodeUrl: string }>>(
      `/members/${id}/qr-code/regenerate`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to regenerate QR code');
    }
    return response.data.data;
  }
}

export const membersService = new MembersService();

