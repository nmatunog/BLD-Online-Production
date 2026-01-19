import {
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class UpdateRoomAssignmentDto {
  @IsString()
  @IsNotEmpty()
  roomAssignment!: string;
}

