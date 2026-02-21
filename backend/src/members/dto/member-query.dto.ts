import { IsString, IsOptional, IsEnum, IsInt, Min, IsBoolean, Allow } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum MemberSortBy {
  NAME = 'name',
  COMMUNITY_ID = 'communityId',
  CITY = 'city',
  ENCOUNTER_TYPE = 'encounterType',
  CREATED_AT = 'createdAt',
}

export class MemberQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  encounterType?: string;

  @IsString()
  @IsOptional()
  ministry?: string;

  @IsString()
  @IsOptional()
  apostolate?: string;

  @IsString()
  @IsOptional()
  role?: string; // User role (e.g. MEMBER, MINISTRY_COORDINATOR)

  @Allow()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean; // Filter by user active status

  @IsString()
  @IsOptional()
  classNumber?: string; // For CLASS_SHEPHERD filtering

  @IsEnum(MemberSortBy)
  @IsOptional()
  sortBy?: MemberSortBy = MemberSortBy.NAME;

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 50;
}
