import { resolveDisplayMinistry, type MinistrySourceMember } from '../member-card-ministry';

export const PUBLIC_VERIFY_MEMBER_FIELDS = [
  'fullName',
  'memberId',
  'ministry',
  'photoUrl',
] as const;

export const PUBLIC_VERIFY_RESULT_FIELDS = ['view', 'status', 'member'] as const;

export type PublicVerifyStatus = 'VALID' | 'REVOKED' | 'NOT_FOUND';

export class PublicVerifyMemberDto {
  fullName!: string;
  memberId!: string;
  ministry!: string;
  photoUrl!: string | null;
}

export class PublicVerifyResultDto {
  view!: 'public';
  status!: PublicVerifyStatus;
  member!: PublicVerifyMemberDto | null;
}

export type PublicVerifySourceMember = MinistrySourceMember & {
  firstName?: string | null;
  lastName?: string | null;
  communityId?: string | null;
  photoUrl?: string | null;
};

export function toPublicVerifyMember(member: PublicVerifySourceMember): PublicVerifyMemberDto {
  const dto = new PublicVerifyMemberDto();
  dto.fullName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
  dto.memberId = member.communityId ?? '';
  dto.ministry = resolveDisplayMinistry(member);
  dto.photoUrl = member.photoUrl ?? null;
  return dto;
}

export function toPublicVerifyResult(input: {
  status: 'ACTIVE' | 'VALID' | 'REVOKED' | 'NOT_FOUND';
  member?: PublicVerifySourceMember | null;
}): PublicVerifyResultDto {
  const dto = new PublicVerifyResultDto();
  dto.view = 'public';

  if (input.status === 'NOT_FOUND' || !input.member) {
    dto.status = 'NOT_FOUND';
    dto.member = null;
    return dto;
  }

  dto.status = input.status === 'REVOKED' ? 'REVOKED' : 'VALID';
  dto.member = toPublicVerifyMember(input.member);
  return dto;
}

export function publicVerifyJson(result: PublicVerifyResultDto): Record<string, unknown> {
  return {
    view: result.view,
    status: result.status,
    member: result.member
      ? {
          fullName: result.member.fullName,
          memberId: result.member.memberId,
          ministry: result.member.ministry,
          photoUrl: result.member.photoUrl,
        }
      : null,
  };
}
