import { PartialType } from '@nestjs/swagger';
import { CreateIncomeEntryDto } from './create-income-entry.dto';

export class UpdateIncomeEntryDto extends PartialType(CreateIncomeEntryDto) {}






