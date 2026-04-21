import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { CreateIncomeEntryDto } from './dto/create-income-entry.dto';
import { CreateExpenseEntryDto } from './dto/create-expense-entry.dto';
import { CreateAdjustmentEntryDto } from './dto/create-adjustment-entry.dto';
import { UpdateIncomeEntryDto } from './dto/update-income-entry.dto';
import { UpdateExpenseEntryDto } from './dto/update-expense-entry.dto';
import { CreateCashAdvanceDto } from './dto/create-cash-advance.dto';
import { UpdateCashAdvanceDto } from './dto/update-cash-advance.dto';
import { SaveLiquidationLinesDto } from './dto/save-liquidation-lines.dto';
import { CreateMonitoredDisbursementDto } from './dto/create-monitored-disbursement.dto';
import { UpdateMonitoredDisbursementDto } from './dto/update-monitored-disbursement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';

@ApiTags('Accounting')
@Controller('accounting')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('events/:eventId')
  @ApiOperation({ summary: 'Get event account with summary' })
  @ApiResponse({ status: 200, description: 'Event account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventAccount(
    @Param('eventId') eventId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const account = await this.accountingService.getEventAccount(eventId);
    return {
      success: true,
      data: account,
      message: 'Event account retrieved successfully',
    };
  }

  @Post('events/:eventId/income')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Create income entry' })
  @ApiResponse({ status: 201, description: 'Income entry created successfully' })
  @ApiResponse({ status: 400, description: 'Account is closed' })
  async createIncomeEntry(
    @Param('eventId') eventId: string,
    @Body() createIncomeEntryDto: CreateIncomeEntryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const entry = await this.accountingService.createIncomeEntry(
      eventId,
      createIncomeEntryDto,
    );
    return {
      success: true,
      data: entry,
      message: 'Income entry created successfully',
    };
  }

  @Post('events/:eventId/expenses')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Create expense entry' })
  @ApiResponse({ status: 201, description: 'Expense entry created successfully' })
  @ApiResponse({ status: 400, description: 'Account is closed' })
  async createExpenseEntry(
    @Param('eventId') eventId: string,
    @Body() createExpenseEntryDto: CreateExpenseEntryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const entry = await this.accountingService.createExpenseEntry(
      eventId,
      createExpenseEntryDto,
    );
    return {
      success: true,
      data: entry,
      message: 'Expense entry created successfully',
    };
  }

  @Put('events/:eventId/income/:entryId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Update income entry' })
  @ApiResponse({ status: 200, description: 'Income entry updated successfully' })
  @ApiResponse({ status: 404, description: 'Income entry not found' })
  async updateIncomeEntry(
    @Param('eventId') eventId: string,
    @Param('entryId') entryId: string,
    @Body() updateIncomeEntryDto: UpdateIncomeEntryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const entry = await this.accountingService.updateIncomeEntry(
      eventId,
      entryId,
      updateIncomeEntryDto,
    );
    return {
      success: true,
      data: entry,
      message: 'Income entry updated successfully',
    };
  }

  @Put('events/:eventId/expenses/:entryId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Update expense entry' })
  @ApiResponse({ status: 200, description: 'Expense entry updated successfully' })
  @ApiResponse({ status: 404, description: 'Expense entry not found' })
  async updateExpenseEntry(
    @Param('eventId') eventId: string,
    @Param('entryId') entryId: string,
    @Body() updateExpenseEntryDto: UpdateExpenseEntryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const entry = await this.accountingService.updateExpenseEntry(
      eventId,
      entryId,
      updateExpenseEntryDto,
    );
    return {
      success: true,
      data: entry,
      message: 'Expense entry updated successfully',
    };
  }

  @Delete('events/:eventId/income/:entryId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete income entry' })
  @ApiResponse({ status: 200, description: 'Income entry deleted successfully' })
  @ApiResponse({ status: 404, description: 'Income entry not found' })
  async deleteIncomeEntry(
    @Param('eventId') eventId: string,
    @Param('entryId') entryId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.accountingService.deleteIncomeEntry(eventId, entryId);
    return {
      success: true,
      data: result,
      message: 'Income entry deleted successfully',
    };
  }

  @Delete('events/:eventId/expenses/:entryId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete expense entry' })
  @ApiResponse({ status: 200, description: 'Expense entry deleted successfully' })
  @ApiResponse({ status: 404, description: 'Expense entry not found' })
  async deleteExpenseEntry(
    @Param('eventId') eventId: string,
    @Param('entryId') entryId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.accountingService.deleteExpenseEntry(eventId, entryId);
    return {
      success: true,
      data: result,
      message: 'Expense entry deleted successfully',
    };
  }

  @Post('events/:eventId/close')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Close event account' })
  @ApiResponse({ status: 200, description: 'Event account closed successfully' })
  async closeEventAccount(
    @Param('eventId') eventId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const account = await this.accountingService.closeEventAccount(eventId);
    return {
      success: true,
      data: account,
      message: 'Event account closed successfully',
    };
  }

  @Post('events/:eventId/reopen')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Reopen event account' })
  @ApiResponse({ status: 200, description: 'Event account reopened successfully' })
  async reopenEventAccount(
    @Param('eventId') eventId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const account = await this.accountingService.reopenEventAccount(eventId);
    return {
      success: true,
      data: account,
      message: 'Event account reopened successfully',
    };
  }

  @Post('events/:eventId/adjustments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Create adjustment entry' })
  @ApiResponse({ status: 201, description: 'Adjustment entry created successfully' })
  @ApiResponse({ status: 400, description: 'Account is closed' })
  async createAdjustmentEntry(
    @Param('eventId') eventId: string,
    @Body() createAdjustmentEntryDto: CreateAdjustmentEntryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const entry = await this.accountingService.createAdjustmentEntry(
      eventId,
      createAdjustmentEntryDto,
    );
    return {
      success: true,
      data: entry,
      message: 'Adjustment entry created successfully',
    };
  }

  @Delete('events/:eventId/adjustments/:entryId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete adjustment entry' })
  @ApiResponse({ status: 200, description: 'Adjustment entry deleted successfully' })
  @ApiResponse({ status: 404, description: 'Adjustment entry not found' })
  async deleteAdjustmentEntry(
    @Param('eventId') eventId: string,
    @Param('entryId') entryId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.accountingService.deleteAdjustmentEntry(eventId, entryId);
    return {
      success: true,
      data: result,
      message: 'Adjustment entry deleted successfully',
    };
  }

  @Get('events/:eventId/report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Generate financial report for event' })
  @ApiResponse({ status: 200, description: 'Financial report generated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async generateFinancialReport(
    @Param('eventId') eventId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const report = await this.accountingService.generateFinancialReport(eventId);
    return {
      success: true,
      data: report,
      message: 'Financial report generated successfully',
    };
  }

  @Post('events/:eventId/cash-advances')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Record cash advance (disbursement; not P&L until liquidation)' })
  async createCashAdvance(
    @Param('eventId') eventId: string,
    @Body() dto: CreateCashAdvanceDto,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.createCashAdvance(eventId, dto);
    return { success: true, data, message: 'Cash advance recorded' };
  }

  @Patch('events/:eventId/cash-advances/:cashAdvanceId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Update cash advance (only while outstanding)' })
  async updateCashAdvance(
    @Param('eventId') eventId: string,
    @Param('cashAdvanceId') cashAdvanceId: string,
    @Body() dto: UpdateCashAdvanceDto,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.updateCashAdvance(eventId, cashAdvanceId, dto);
    return { success: true, data, message: 'Cash advance updated' };
  }

  @Delete('events/:eventId/cash-advances/:cashAdvanceId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete cash advance (only if not liquidated)' })
  async deleteCashAdvance(
    @Param('eventId') eventId: string,
    @Param('cashAdvanceId') cashAdvanceId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.deleteCashAdvance(eventId, cashAdvanceId);
    return { success: true, data, message: 'Cash advance deleted' };
  }

  @Put('events/:eventId/cash-advances/:cashAdvanceId/liquidation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Save liquidation draft (line items; posts expenses on approve)' })
  async saveLiquidationDraft(
    @Param('eventId') eventId: string,
    @Param('cashAdvanceId') cashAdvanceId: string,
    @Body() dto: SaveLiquidationLinesDto,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.saveLiquidationDraft(eventId, cashAdvanceId, dto);
    return { success: true, data, message: 'Liquidation draft saved' };
  }

  @Post('events/:eventId/liquidations/:liquidationId/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Approve liquidation — creates expense entries from lines' })
  async approveLiquidation(
    @Param('eventId') eventId: string,
    @Param('liquidationId') liquidationId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.approveLiquidation(eventId, liquidationId);
    return { success: true, data, message: 'Liquidation approved; expenses posted' };
  }

  @Post('events/:eventId/monitored-disbursements')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Record other cash out for monitoring (not expense)' })
  async createMonitoredDisbursement(
    @Param('eventId') eventId: string,
    @Body() dto: CreateMonitoredDisbursementDto,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.createMonitoredDisbursement(eventId, dto);
    return { success: true, data, message: 'Monitored disbursement recorded' };
  }

  @Patch('events/:eventId/monitored-disbursements/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Update monitored disbursement' })
  async updateMonitoredDisbursement(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMonitoredDisbursementDto,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.updateMonitoredDisbursement(eventId, id, dto);
    return { success: true, data, message: 'Monitored disbursement updated' };
  }

  @Delete('events/:eventId/monitored-disbursements/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete monitored disbursement' })
  async deleteMonitoredDisbursement(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.accountingService.deleteMonitoredDisbursement(eventId, id);
    return { success: true, data, message: 'Monitored disbursement deleted' };
  }
}






