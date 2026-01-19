import { IsString, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class AssignClassShepherdDto {
  @IsString()
  @IsNotEmpty()
  userId!: string; // User ID with CLASS_SHEPHERD role

  @IsString()
  @IsNotEmpty()
  encounterType!: string; // e.g., "ME", "SE", "SPE", "YE"

  @IsInt()
  @Min(1)
  @Max(999)
  classNumber!: number; // e.g., 18 for ME Class 18
}

