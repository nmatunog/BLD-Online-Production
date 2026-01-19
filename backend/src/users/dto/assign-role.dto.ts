import { IsEnum, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { UserRole } from '@prisma/client';

export class AssignRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;

  // For CLASS_SHEPHERD: which encounter class they shepherd
  @IsString()
  @IsOptional()
  shepherdEncounterType?: string; // e.g., "ME", "SE", "SPE", "YE"

  @IsInt()
  @Min(1)
  @Max(999)
  @IsOptional()
  shepherdClassNumber?: number; // e.g., 101 for ME Class 101

  // For MINISTRY_COORDINATOR: which ministry they coordinate
  @IsString()
  @IsOptional()
  ministry?: string;
}

