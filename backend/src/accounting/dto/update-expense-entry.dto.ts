import { PartialType } from '@nestjs/swagger';
import { CreateExpenseEntryDto } from './create-expense-entry.dto';

export class UpdateExpenseEntryDto extends PartialType(CreateExpenseEntryDto) {}






