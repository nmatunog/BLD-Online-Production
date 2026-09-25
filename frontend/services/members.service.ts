import { apiClient } from './api-client';
import { SESSION_EXPIRED_MESSAGE } from './api-client-token';
import { asHumanErrorMessage, getErrorMessage } from '@/lib/get-error-message';
import { ApiResponse } from '@/types/api.types';

/** rembg/normalize often takes 8–15s; keep well above the 10s axios default. */
export const PHOTO_UPLOAD_TIMEOUT_MS = 60_000;

const PHOTO_DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extensionForImageMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

/**
 * Prefer multipart `file` (Nest FileInterceptor). Fall back to JSON `{ photoDataUrl }`
 * when FormData is unavailable or the data URL cannot be decoded.
 */
export function buildMemberPhotoUploadBody(
  photoDataUrl: string,
): FormData | { photoDataUrl: string } {
  if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    return { photoDataUrl };
  }
  try {
    const match = photoDataUrl.match(PHOTO_DATA_URL_RE);
    if (!match) return { photoDataUrl };
    const mime = match[1];
    const bytes = base64ToUint8Array(match[2]);
    if (!bytes.byteLength) return { photoDataUrl };
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const form = new FormData();
    form.append('file', new Blob([copy], { type: mime }), `id-photo.${extensionForImageMime(mime)}`);
    return form;
  } catch {
    return { photoDataUrl };
  }
}

export function getMemberApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === SESSION_EXPIRED_MESSAGE) {
    return SESSION_EXPIRED_MESSAGE;
  }
  const axiosErr = error as { response?: { status?: number } };
  if (axiosErr?.response?.status === 401) {
    const fromServer = getErrorMessage(error, '');
    if (fromServer && fromServer !== fallback && !/^Request failed/i.test(fromServer)) {
      return fromServer;
    }
    return SESSION_EXPIRED_MESSAGE;
  }
  return getErrorMessage(error, fallback);
}

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
  bloodType?: string | null;
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
  firstName?: string;
  lastName?: string;
  city?: string;
  encounterType?: string;
  ministry?: string;
  apostolate?: string;
  role?: string;
  isActive?: boolean;
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
  bloodType?: string | null;
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

  async uploadMyPhoto(photoDataUrl: string): Promise<string> {
    try {
      await apiClient.ensureFreshToken();
      const response = await apiClient.post<ApiResponse<{ photoUrl: string }>>(
        '/members/me/photo',
        buildMemberPhotoUploadBody(photoDataUrl),
        { timeout: PHOTO_UPLOAD_TIMEOUT_MS },
      );
      if (!response.data.success || !response.data.data?.photoUrl) {
        throw new Error(asHumanErrorMessage(response.data.error, 'Failed to upload photo'));
      }
      return response.data.data.photoUrl;
    } catch (error) {
      throw new Error(getMemberApiErrorMessage(error, 'Failed to upload photo'));
    }
  }

  async uploadMemberPhoto(memberId: string, photoDataUrl: string): Promise<string> {
    try {
      await apiClient.ensureFreshToken();
      const response = await apiClient.post<ApiResponse<{ photoUrl: string }>>(
        `/members/${memberId}/photo`,
        buildMemberPhotoUploadBody(photoDataUrl),
        { timeout: PHOTO_UPLOAD_TIMEOUT_MS },
      );
      if (!response.data.success || !response.data.data?.photoUrl) {
        throw new Error(asHumanErrorMessage(response.data.error, 'Failed to upload photo'));
      }
      return response.data.data.photoUrl;
    } catch (error) {
      throw new Error(getMemberApiErrorMessage(error, 'Failed to upload photo'));
    }
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

