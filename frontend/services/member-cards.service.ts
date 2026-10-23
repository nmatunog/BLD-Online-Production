import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';
import type { DoorVerifyStatus, MemberCardStatus, PublicCardMember } from '@/lib/nfc-card';

function ensureBody<T>(response: { data?: ApiResponse<T> }): ApiResponse<T> {
  const body = response?.data;
  if (body == null) {
    return { success: false, error: 'Empty response from server' };
  }
  return body;
}

export interface MemberCardListItem {
  id: string;
  memberId: string;
  status: MemberCardStatus;
  issuedAt: string;
  revokedAt: string | null;
  encodedAt: string | null;
  lastVerifiedAt: string | null;
  member: PublicCardMember;
}

export interface MemberCardListResult {
  data: MemberCardListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IssueResult {
  issued: Array<{ cardId: string; memberId: string; nfcUrl: string; token: string }>;
  skipped: Array<{ memberId: string; reason: string; cardId?: string }>;
}

export interface ReissueResult {
  card: MemberCardListItem;
  token: string;
  nfcUrl: string;
}

export interface WriteReadyCard {
  cardId: string;
  memberId: string;
  alreadyIssued: boolean;
  token: string;
  nfcUrl: string;
  member: PublicCardMember;
}

export interface VerifyResult {
  status: DoorVerifyStatus;
  cardStatus: MemberCardStatus | null;
  member: PublicCardMember | null;
  cardId: string | null;
}

export interface PrinterExportRow {
  cardId: string;
  memberId: string;
  name: string;
  communityId: string;
  ministry: string;
  photoUrl: string;
  nfcUrl: string;
  token: string;
  status: MemberCardStatus;
  issuedAt: string;
  encodedAt: string | null;
}

class MemberCardsService {
  async list(params?: {
    search?: string;
    status?: MemberCardStatus;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<MemberCardListResult>> {
    const response = await apiClient.get<ApiResponse<MemberCardListResult>>('/member-cards', {
      params,
    });
    return ensureBody(response);
  }

  async issue(memberIds: string[]): Promise<ApiResponse<IssueResult>> {
    const response = await apiClient.post<ApiResponse<IssueResult>>('/member-cards/issue', {
      memberIds,
    });
    return ensureBody(response);
  }

  async issueForWrite(memberId: string): Promise<ApiResponse<WriteReadyCard>> {
    const response = await apiClient.post<ApiResponse<WriteReadyCard>>(
      '/member-cards/issue-for-write',
      { memberId },
    );
    return ensureBody(response);
  }

  async revoke(cardId: string): Promise<ApiResponse<MemberCardListItem>> {
    const response = await apiClient.post<ApiResponse<MemberCardListItem>>(
      `/member-cards/${cardId}/revoke`,
    );
    return ensureBody(response);
  }

  async reissue(cardId: string): Promise<ApiResponse<ReissueResult>> {
    const response = await apiClient.post<ApiResponse<ReissueResult>>(
      `/member-cards/${cardId}/reissue`,
    );
    return ensureBody(response);
  }

  async markEncoded(cardId: string): Promise<ApiResponse<MemberCardListItem>> {
    const response = await apiClient.post<ApiResponse<MemberCardListItem>>(
      `/member-cards/${cardId}/mark-encoded`,
    );
    return ensureBody(response);
  }

  async exportRows(params?: {
    search?: string;
    status?: MemberCardStatus;
  }): Promise<ApiResponse<PrinterExportRow[]>> {
    const response = await apiClient.get<ApiResponse<PrinterExportRow[]>>('/member-cards/export', {
      params,
    });
    return ensureBody(response);
  }

  async verify(token: string): Promise<ApiResponse<VerifyResult>> {
    const response = await apiClient.get<ApiResponse<VerifyResult>>(
      `/member-cards/verify/${encodeURIComponent(token)}`,
    );
    return ensureBody(response);
  }

  async checkIn(
    token: string,
    eventId: string,
    sessionSlot?: string,
  ): Promise<ApiResponse<unknown>> {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/member-cards/verify/${encodeURIComponent(token)}/check-in`,
      { eventId, ...(sessionSlot ? { sessionSlot } : {}) },
    );
    return ensureBody(response);
  }
}

export const memberCardsService = new MemberCardsService();
