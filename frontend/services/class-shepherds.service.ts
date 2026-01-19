import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

export interface ClassShepherdAssignment {
  id: string;
  eventId: string;
  userId: string;
  encounterType: string;
  classNumber: number;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    member: {
      id: string;
      firstName: string;
      lastName: string;
      nickname: string | null;
      communityId: string;
    } | null;
  };
}

export interface ClassShepherdGroup {
  encounterType: string;
  classNumber: number;
  shepherds: ClassShepherdAssignment[];
}

export interface ClassShepherdResponse {
  assignments: ClassShepherdAssignment[];
  grouped: ClassShepherdGroup[];
}

export interface AssignClassShepherdRequest {
  userId: string;
  encounterType: string;
  classNumber: number;
}

class ClassShepherdsService {
  /**
   * Assign a Class Shepherd to an Encounter Event for a specific encounter class
   */
  async assignClassShepherd(
    eventId: string,
    data: AssignClassShepherdRequest,
  ): Promise<ClassShepherdAssignment> {
    const response = await apiClient.post<ApiResponse<ClassShepherdAssignment>>(
      `/events/${eventId}/class-shepherds`,
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to assign Class Shepherd');
    }
    return response.data.data;
  }

  /**
   * Get all Class Shepherd assignments for an event
   */
  async getClassShepherds(eventId: string): Promise<ClassShepherdResponse> {
    const response = await apiClient.get<ApiResponse<ClassShepherdResponse>>(
      `/events/${eventId}/class-shepherds`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get Class Shepherds');
    }
    return response.data.data;
  }

  /**
   * Get Class Shepherd assignments for a specific encounter class
   */
  async getClassShepherdsByClass(
    eventId: string,
    encounterType: string,
    classNumber: number,
  ): Promise<ClassShepherdAssignment[]> {
    const response = await apiClient.get<ApiResponse<ClassShepherdAssignment[]>>(
      `/events/${eventId}/class-shepherds/${encounterType}/${classNumber}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get Class Shepherds');
    }
    return response.data.data;
  }

  /**
   * Remove a Class Shepherd assignment
   */
  async removeClassShepherd(
    eventId: string,
    assignmentId: string,
  ): Promise<void> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/events/${eventId}/class-shepherds/${assignmentId}`,
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove Class Shepherd');
    }
  }
}

export const classShepherdsService = new ClassShepherdsService();

