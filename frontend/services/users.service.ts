import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

export type UserRole = 'SUPER_USER' | 'ADMINISTRATOR' | 'DCS' | 'MINISTRY_COORDINATOR' | 'CLASS_SHEPHERD' | 'MEMBER';

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  shepherdEncounterType?: string | null;
  shepherdClassNumber?: number | null;
  ministry?: string | null;
  createdAt: string;
  updatedAt: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    nickname: string | null;
    communityId: string;
    encounterType?: string;
    classNumber?: number;
  } | null;
}

export interface AssignRoleRequest {
  role: UserRole;
  shepherdEncounterType?: string;
  shepherdClassNumber?: number;
  ministry?: string;
}

class UsersService {
  async getAllUsers(): Promise<User[]> {
    const response = await apiClient.get<ApiResponse<User[]>>('/users');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch users');
    }
    return response.data.data;
  }

  async assignRole(userId: string, data: AssignRoleRequest): Promise<User> {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${userId}/role`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to assign role');
    }
    return response.data.data;
  }

  async removeRole(userId: string, role: UserRole): Promise<User> {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${userId}/role/remove`, { role });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to remove role');
    }
    return response.data.data;
  }
}

export const usersService = new UsersService();

