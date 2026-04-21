import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CashAdvanceStatus, LiquidationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
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

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateAccount(eventId: string) {
    // Try with adjustmentEntries first (if migration has been run)
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          account: {
            include: {
              incomeEntries: true,
              expenseEntries: true,
              adjustmentEntries: true,
            },
          },
        },
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      if (event.account) {
        // Ensure adjustmentEntries exists (in case migration hasn't been run)
        return {
          ...event.account,
          adjustmentEntries: (event.account as any).adjustmentEntries || [],
        };
      }

      const newAccount = await this.prisma.eventAccount.create({
        data: { eventId },
        include: {
          incomeEntries: true,
          expenseEntries: true,
          adjustmentEntries: true,
        },
      });

      return {
        ...newAccount,
        adjustmentEntries: (newAccount as any).adjustmentEntries || [],
      };
    } catch (error: any) {
      // If adjustmentEntries doesn't exist (migration not run), try without it
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      
      if (
        errorMessage.includes('adjustmentEntries') ||
        errorMessage.includes('Unknown argument') ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('Unknown field') ||
        errorCode === 'P2025' ||
        errorCode === 'P2009' ||
        errorCode === 'P2014'
      ) {
        // Retry without adjustmentEntries
        const event = await this.prisma.event.findUnique({
          where: { id: eventId },
          include: {
            account: {
              include: {
                incomeEntries: true,
                expenseEntries: true,
              },
            },
          },
        });

        if (!event) {
          throw new NotFoundException('Event not found');
        }

        if (event.account) {
          return {
            ...event.account,
            adjustmentEntries: [],
          };
        }

        const newAccount = await this.prisma.eventAccount.create({
          data: { eventId },
          include: {
            incomeEntries: true,
            expenseEntries: true,
          },
        });

        return {
          ...newAccount,
          adjustmentEntries: [],
        };
      }
      // Re-throw if it's a different error
      throw error;
    }
  }

  async getEventAccount(eventId: string) {
    const account = await this.getOrCreateAccount(eventId);

    // Ensure adjustmentEntries exists (defensive programming)
    const adjustmentEntries = (account as any).adjustmentEntries || [];

    const [cashAdvances, monitoredDisbursements] = await Promise.all([
      this.prisma.cashAdvance.findMany({
        where: { accountId: account.id },
        include: {
          liquidation: {
            include: {
              lines: {
                include: {
                  expenseEntry: { select: { id: true } },
                },
              },
            },
          },
        },
        orderBy: { disbursedAt: 'desc' },
      }),
      this.prisma.monitoredDisbursement.findMany({
        where: { accountId: account.id },
        orderBy: { disbursedAt: 'desc' },
      }),
    ]);

    const totalIncome = account.incomeEntries.reduce(
      (sum, e: any) => sum + Number(e.amount || 0),
      0,
    );
    const totalExpense = account.expenseEntries.reduce(
      (sum, e: any) => sum + Number(e.amount || 0),
      0,
    );
    const totalAdjustment = adjustmentEntries.reduce(
      (sum: number, e: any) => sum + Number(e.amount || 0),
      0,
    );

    const totalCashAdvanceDisbursed = cashAdvances.reduce(
      (s, ca) => s + Number(ca.amount || 0),
      0,
    );
    const totalMonitoredDisbursement = monitoredDisbursements.reduce(
      (s, m) => s + Number(m.amount || 0),
      0,
    );
    const outstandingCashAdvances = cashAdvances.filter((c) => c.status === CashAdvanceStatus.OUTSTANDING);
    const outstandingCashAdvanceAmount = outstandingCashAdvances.reduce(
      (s, c) => s + Number(c.amount || 0),
      0,
    );

    return {
      ...account,
      adjustmentEntries, // Ensure it's always present
      cashAdvances,
      monitoredDisbursements,
      summary: {
        totalIncome,
        totalExpenses: totalExpense,
        totalAdjustments: totalAdjustment,
        netBalance: totalIncome - totalExpense + totalAdjustment,
        incomeCount: account.incomeEntries.length,
        expenseCount: account.expenseEntries.length,
        adjustmentCount: adjustmentEntries.length,
        totalCashAdvanceDisbursed,
        totalMonitoredDisbursement,
        totalTrackedCashDisbursement: totalCashAdvanceDisbursed + totalMonitoredDisbursement,
        outstandingCashAdvanceCount: outstandingCashAdvances.length,
        outstandingCashAdvanceAmount,
      },
    };
  }

  async generateFinancialReport(eventId: string) {
    const account = await this.getOrCreateAccount(eventId);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        location: true,
        venue: true,
        status: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const [cashAdvanceReportRows, monitoredReportRows] = await Promise.all([
      this.prisma.cashAdvance.findMany({
        where: { accountId: account.id },
        include: { liquidation: { include: { lines: true } } },
        orderBy: { disbursedAt: 'desc' },
      }),
      this.prisma.monitoredDisbursement.findMany({
        where: { accountId: account.id },
        orderBy: { disbursedAt: 'desc' },
      }),
    ]);

    const totalCashAdvanceDisbursedRpt = cashAdvanceReportRows.reduce(
      (s, ca) => s + Number(ca.amount || 0),
      0,
    );
    const totalMonitoredDisbursementRpt = monitoredReportRows.reduce(
      (s, m) => s + Number(m.amount || 0),
      0,
    );
    const outstandingCaRpt = cashAdvanceReportRows.filter((c) => c.status === CashAdvanceStatus.OUTSTANDING);

    // Get paid registrations to create individual income entries for each participant
    const paidRegistrations = await this.prisma.eventRegistration.findMany({
      where: {
        eventId: eventId,
        paymentStatus: 'PAID',
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Create individual income entries for each paid registration
    const registrationIncomeEntries = paidRegistrations.map((reg: any) => {
      let participantName = '';
      if (reg.member) {
        participantName = `${reg.member.firstName} ${reg.member.lastName}`;
      } else if (reg.registrationType === 'COUPLE' && reg.spouseFirstName) {
        participantName = `${reg.firstName} ${reg.lastName} & ${reg.spouseFirstName} ${reg.spouseLastName}`;
      } else {
        participantName = `${reg.firstName} ${reg.lastName}`;
      }

      return {
        date: reg.createdAt, // Use registration date
        description: `Registration fee - ${participantName}`,
        source: 'Registration Fees',
        amount: Number(reg.paymentAmount || 0),
        remarks: reg.member?.communityId || 'Non-member',
        orNumber: reg.paymentReference || `REG-${reg.id.substring(0, 8).toUpperCase()}`,
        registrationId: reg.id,
      };
    });

    // Combine manual income entries with registration entries
    const allIncomeEntries = [
      ...account.incomeEntries.map((entry: any) => ({
        date: entry.receivedAt,
        description: entry.description,
        source: entry.source || '',
        amount: Number(entry.amount || 0),
        remarks: entry.remarks || '',
        orNumber: this.generateORNumber(entry.id, entry.receivedAt),
        registrationId: null,
      })),
      ...registrationIncomeEntries,
    ];

    // Calculate totals including registration entries
    const totalIncome = allIncomeEntries.reduce(
      (sum, e: any) => sum + Number(e.amount || 0),
      0,
    );
    const totalExpense = account.expenseEntries.reduce(
      (sum, e: any) => sum + Number(e.amount || 0),
      0,
    );
    const totalAdjustment = account.adjustmentEntries?.reduce(
      (sum: number, e: any) => sum + Number(e.amount || 0),
      0,
    ) || 0;
    const netBalance = totalIncome - totalExpense + totalAdjustment;

    // Group income by source (including registration entries)
    const incomeBySource = allIncomeEntries.reduce((acc: any, entry: any) => {
      const source = entry.source || 'Unspecified';
      if (!acc[source]) {
        acc[source] = { source, total: 0, count: 0, entries: [] };
      }
      acc[source].total += Number(entry.amount || 0);
      acc[source].count += 1;
      acc[source].entries.push({
        date: entry.date,
        description: entry.description,
        amount: Number(entry.amount || 0),
        remarks: entry.remarks || '',
        orNumber: entry.orNumber,
      });
      return acc;
    }, {});

    // Group expenses by category
    const expensesByCategory = account.expenseEntries.reduce((acc: any, entry: any) => {
      const category = entry.category || 'Unspecified';
      if (!acc[category]) {
        acc[category] = { category, total: 0, count: 0, entries: [] };
      }
      acc[category].total += Number(entry.amount || 0);
      acc[category].count += 1;
      acc[category].entries.push({
        date: entry.paidAt,
        description: entry.description,
        amount: Number(entry.amount || 0),
        remarks: entry.remarks || '',
        orNumber: this.generateORNumber(entry.id, entry.paidAt),
      });
      return acc;
    }, {});

    // Prepare report data array
    const reportData = {
      event: {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        venue: event.venue,
        status: event.status,
      },
      account: {
        id: account.id,
        isClosed: account.isClosed,
        closedAt: account.closedAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
      summary: {
        totalIncome,
        totalExpenses: totalExpense,
        totalAdjustments: totalAdjustment,
        netBalance,
        incomeCount: account.incomeEntries.length,
        expenseCount: account.expenseEntries.length,
        adjustmentCount: account.adjustmentEntries?.length || 0,
        profitMargin: totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(2) : '0.00',
        expenseRatio: totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(2) : '0.00',
      },
      incomeBySource: Object.values(incomeBySource),
      expensesByCategory: Object.values(expensesByCategory),
      incomeEntries: allIncomeEntries.map((entry: any) => ({
        date: entry.date,
        description: entry.description,
        source: entry.source || '',
        amount: Number(entry.amount || 0),
        remarks: entry.remarks || '',
        orNumber: entry.orNumber || '',
        registrationId: entry.registrationId || null,
      })),
      expenseEntries: account.expenseEntries.map((entry: any) => ({
        date: entry.paidAt,
        description: entry.description,
        category: entry.category || '',
        amount: Number(entry.amount || 0),
        remarks: entry.remarks || '',
        orNumber: this.generateORNumber(entry.id, entry.paidAt),
        fromLiquidation: Boolean(entry.liquidationLineId),
      })),
      adjustmentEntries: account.adjustmentEntries?.map((entry: any) => ({
        date: entry.adjustedAt,
        description: entry.description,
        amount: Number(entry.amount || 0),
        remarks: entry.remarks || '',
      })) || [],
      cashAdvances: cashAdvanceReportRows.map((ca) => ({
        id: ca.id,
        amount: Number(ca.amount || 0),
        disbursedAt: ca.disbursedAt,
        payeeName: ca.payeeName,
        referenceNumber: ca.referenceNumber,
        notation: ca.notation,
        status: ca.status,
        liquidation: ca.liquidation
          ? {
              id: ca.liquidation.id,
              status: ca.liquidation.status,
              notation: ca.liquidation.notation,
              approvedAt: ca.liquidation.approvedAt,
              lines: ca.liquidation.lines.map((ln) => ({
                id: ln.id,
                description: ln.description,
                amount: Number(ln.amount || 0),
                category: ln.category,
                orVoucherNumber: ln.orVoucherNumber,
                paidAt: ln.paidAt,
              })),
            }
          : null,
      })),
      monitoredDisbursements: monitoredReportRows.map((m) => ({
        id: m.id,
        label: m.label,
        amount: Number(m.amount || 0),
        disbursedAt: m.disbursedAt,
        payeeName: m.payeeName,
        referenceNumber: m.referenceNumber,
        notation: m.notation,
      })),
      cashMonitoringSummary: {
        totalCashAdvanceDisbursed: totalCashAdvanceDisbursedRpt,
        totalMonitoredDisbursement: totalMonitoredDisbursementRpt,
        totalTrackedCashDisbursement: totalCashAdvanceDisbursedRpt + totalMonitoredDisbursementRpt,
        outstandingCashAdvanceCount: outstandingCaRpt.length,
        outstandingCashAdvanceAmount: outstandingCaRpt.reduce((s, c) => s + Number(c.amount || 0), 0),
      },
      generatedAt: new Date().toISOString(),
    };

    return reportData;
  }

  private ensureOpen(account: { isClosed: boolean }) {
    if (account.isClosed) {
      throw new BadRequestException('Account is closed');
    }
  }

  /**
   * Generate OR (Official Receipt) number from entry ID and date
   * Format: OR-YYYYMMDD-XXXXX (last 5 chars of ID)
   */
  private generateORNumber(entryId: string, date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const idSuffix = entryId.substring(entryId.length - 5).toUpperCase();
    return `OR-${year}${month}${day}-${idSuffix}`;
  }

  async createIncomeEntry(eventId: string, dto: CreateIncomeEntryDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    return await this.prisma.incomeEntry.create({
      data: {
        accountId: account.id,
        description: dto.description,
        amount: dto.amount as any,
        source: dto.source,
        remarks: dto.remarks,
        orVoucherNumber: dto.orVoucherNumber,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
      },
    });
  }

  async createExpenseEntry(eventId: string, dto: CreateExpenseEntryDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    return await this.prisma.expenseEntry.create({
      data: {
        accountId: account.id,
        description: dto.description,
        amount: dto.amount as any,
        category: dto.category,
        remarks: dto.remarks,
        orVoucherNumber: dto.orVoucherNumber,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
    });
  }

  async updateIncomeEntry(eventId: string, entryId: string, dto: UpdateIncomeEntryDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.incomeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.accountId != account.id) {
      throw new NotFoundException('Income entry not found');
    }

    return await this.prisma.incomeEntry.update({
      where: { id: entryId },
      data: {
        description: dto.description,
        amount: dto.amount as any,
        source: dto.source,
        remarks: dto.remarks,
        orVoucherNumber: dto.orVoucherNumber,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
      },
    });
  }

  async updateExpenseEntry(eventId: string, entryId: string, dto: UpdateExpenseEntryDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.expenseEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.accountId != account.id) {
      throw new NotFoundException('Expense entry not found');
    }
    if (existing.liquidationLineId) {
      throw new BadRequestException('Cannot edit an expense posted from a liquidation');
    }

    return await this.prisma.expenseEntry.update({
      where: { id: entryId },
      data: {
        description: dto.description,
        amount: dto.amount as any,
        category: dto.category,
        remarks: dto.remarks,
        orVoucherNumber: dto.orVoucherNumber,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
    });
  }

  async deleteIncomeEntry(eventId: string, entryId: string) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.incomeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.accountId != account.id) {
      throw new NotFoundException('Income entry not found');
    }

    await this.prisma.incomeEntry.delete({ where: { id: entryId } });
    return { deleted: true };
  }

  async deleteExpenseEntry(eventId: string, entryId: string) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.expenseEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.accountId != account.id) {
      throw new NotFoundException('Expense entry not found');
    }

    if (existing.liquidationLineId) {
      throw new BadRequestException(
        'This expense was posted from an approved liquidation. Reverse the liquidation workflow instead of deleting this line.',
      );
    }

    await this.prisma.expenseEntry.delete({ where: { id: entryId } });
    return { deleted: true };
  }

  async closeEventAccount(eventId: string) {
    const account = await this.getOrCreateAccount(eventId);
    if (account.isClosed) return account;

    return await this.prisma.eventAccount.update({
      where: { id: account.id },
      data: {
        isClosed: true,
        closedAt: new Date(),
      },
      include: {
        incomeEntries: true,
        expenseEntries: true,
        adjustmentEntries: true,
      },
    });
  }

  async reopenEventAccount(eventId: string) {
    const account = await this.getOrCreateAccount(eventId);
    if (!account.isClosed) return account;

    return await this.prisma.eventAccount.update({
      where: { id: account.id },
      data: {
        isClosed: false,
        closedAt: null,
      },
      include: {
        incomeEntries: true,
        expenseEntries: true,
        adjustmentEntries: true,
      },
    });
  }

  async createAdjustmentEntry(eventId: string, dto: CreateAdjustmentEntryDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    return await this.prisma.adjustmentEntry.create({
      data: {
        accountId: account.id,
        description: dto.description,
        amount: dto.amount as any,
        remarks: dto.remarks,
        orVoucherNumber: dto.orVoucherNumber,
        adjustedAt: dto.adjustedAt ? new Date(dto.adjustedAt) : undefined,
      },
    });
  }

  async deleteAdjustmentEntry(eventId: string, entryId: string) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.adjustmentEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.accountId != account.id) {
      throw new NotFoundException('Adjustment entry not found');
    }

    await this.prisma.adjustmentEntry.delete({ where: { id: entryId } });
    return { deleted: true };
  }

  async createCashAdvance(eventId: string, dto: CreateCashAdvanceDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    return await this.prisma.cashAdvance.create({
      data: {
        accountId: account.id,
        amount: dto.amount as any,
        disbursedAt: dto.disbursedAt ? new Date(dto.disbursedAt) : undefined,
        payeeName: dto.payeeName,
        referenceNumber: dto.referenceNumber,
        notation: dto.notation,
      },
      include: { liquidation: { include: { lines: true } } },
    });
  }

  async updateCashAdvance(eventId: string, cashAdvanceId: string, dto: UpdateCashAdvanceDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.cashAdvance.findFirst({
      where: { id: cashAdvanceId, accountId: account.id },
      include: { liquidation: true },
    });
    if (!existing) {
      throw new NotFoundException('Cash advance not found');
    }
    if (existing.status === CashAdvanceStatus.LIQUIDATED) {
      throw new BadRequestException('Cannot edit a liquidated cash advance');
    }

    return await this.prisma.cashAdvance.update({
      where: { id: cashAdvanceId },
      data: {
        ...(dto.amount !== undefined ? { amount: dto.amount as any } : {}),
        ...(dto.disbursedAt !== undefined ? { disbursedAt: new Date(dto.disbursedAt) } : {}),
        ...(dto.payeeName !== undefined ? { payeeName: dto.payeeName } : {}),
        ...(dto.referenceNumber !== undefined ? { referenceNumber: dto.referenceNumber } : {}),
        ...(dto.notation !== undefined ? { notation: dto.notation } : {}),
      },
      include: { liquidation: { include: { lines: true } } },
    });
  }

  async deleteCashAdvance(eventId: string, cashAdvanceId: string) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.cashAdvance.findFirst({
      where: { id: cashAdvanceId, accountId: account.id },
      include: { liquidation: true },
    });
    if (!existing) {
      throw new NotFoundException('Cash advance not found');
    }
    if (existing.status === CashAdvanceStatus.LIQUIDATED) {
      throw new BadRequestException('Cannot delete a liquidated cash advance');
    }
    if (existing.liquidation?.status === LiquidationStatus.APPROVED) {
      throw new BadRequestException('Cannot delete a cash advance with an approved liquidation');
    }

    await this.prisma.cashAdvance.delete({ where: { id: cashAdvanceId } });
    return { deleted: true };
  }

  async saveLiquidationDraft(eventId: string, cashAdvanceId: string, dto: SaveLiquidationLinesDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const ca = await this.prisma.cashAdvance.findFirst({
      where: { id: cashAdvanceId, accountId: account.id },
      include: { liquidation: true },
    });
    if (!ca) {
      throw new NotFoundException('Cash advance not found');
    }
    if (ca.status === CashAdvanceStatus.LIQUIDATED) {
      throw new BadRequestException('Cash advance is already liquidated');
    }
    if (ca.liquidation?.status === LiquidationStatus.APPROVED) {
      throw new BadRequestException('Liquidation is already approved');
    }

    let liquidationId = ca.liquidation?.id;
    if (!liquidationId) {
      const created = await this.prisma.liquidation.create({
        data: {
          cashAdvanceId: ca.id,
          notation: dto.notation,
        },
      });
      liquidationId = created.id;
    } else {
      await this.prisma.liquidation.update({
        where: { id: liquidationId },
        data: {
          notation:
            dto.notation !== undefined ? dto.notation : ca.liquidation?.notation ?? undefined,
        },
      });
      await this.prisma.liquidationLine.deleteMany({ where: { liquidationId } });
    }

    if (dto.lines?.length) {
      await this.prisma.liquidationLine.createMany({
        data: dto.lines.map((l) => ({
          liquidationId: liquidationId!,
          description: l.description,
          amount: l.amount as any,
          category: l.category,
          orVoucherNumber: l.orVoucherNumber,
          paidAt: l.paidAt ? new Date(l.paidAt) : null,
        })),
      });
    }

    return await this.prisma.liquidation.findUniqueOrThrow({
      where: { id: liquidationId },
      include: { lines: true, cashAdvance: true },
    });
  }

  async approveLiquidation(eventId: string, liquidationId: string) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const liq = await this.prisma.liquidation.findFirst({
      where: {
        id: liquidationId,
        cashAdvance: { accountId: account.id },
      },
      include: {
        lines: true,
        cashAdvance: true,
      },
    });
    if (!liq) {
      throw new NotFoundException('Liquidation not found');
    }
    if (liq.status === LiquidationStatus.APPROVED) {
      throw new BadRequestException('Liquidation already approved');
    }
    if (!liq.lines.length) {
      throw new BadRequestException('Add at least one liquidation line before approving');
    }

    const approvedAt = new Date();
    const caRef = liq.cashAdvance.referenceNumber || liq.cashAdvance.id.slice(0, 8);

    await this.prisma.$transaction(async (tx) => {
      for (const line of liq.lines) {
        await tx.expenseEntry.create({
          data: {
            accountId: account.id,
            description: line.description,
            amount: line.amount as any,
            category: line.category,
            remarks: `LR; CA ${caRef}`,
            orVoucherNumber: line.orVoucherNumber,
            paidAt: line.paidAt ?? approvedAt,
            liquidationLineId: line.id,
          },
        });
      }
      await tx.liquidation.update({
        where: { id: liq.id },
        data: { status: LiquidationStatus.APPROVED, approvedAt },
      });
      await tx.cashAdvance.update({
        where: { id: liq.cashAdvanceId },
        data: { status: CashAdvanceStatus.LIQUIDATED },
      });
    });

    return await this.prisma.liquidation.findUniqueOrThrow({
      where: { id: liquidationId },
      include: {
        lines: { include: { expenseEntry: { select: { id: true, amount: true } } } },
        cashAdvance: true,
      },
    });
  }

  async createMonitoredDisbursement(eventId: string, dto: CreateMonitoredDisbursementDto) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    return await this.prisma.monitoredDisbursement.create({
      data: {
        accountId: account.id,
        amount: dto.amount as any,
        disbursedAt: dto.disbursedAt ? new Date(dto.disbursedAt) : undefined,
        label: dto.label,
        payeeName: dto.payeeName,
        referenceNumber: dto.referenceNumber,
        notation: dto.notation,
      },
    });
  }

  async updateMonitoredDisbursement(
    eventId: string,
    id: string,
    dto: UpdateMonitoredDisbursementDto,
  ) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.monitoredDisbursement.findFirst({
      where: { id, accountId: account.id },
    });
    if (!existing) {
      throw new NotFoundException('Monitored disbursement not found');
    }

    return await this.prisma.monitoredDisbursement.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined ? { amount: dto.amount as any } : {}),
        ...(dto.disbursedAt !== undefined ? { disbursedAt: new Date(dto.disbursedAt) } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.payeeName !== undefined ? { payeeName: dto.payeeName } : {}),
        ...(dto.referenceNumber !== undefined ? { referenceNumber: dto.referenceNumber } : {}),
        ...(dto.notation !== undefined ? { notation: dto.notation } : {}),
      },
    });
  }

  async deleteMonitoredDisbursement(eventId: string, id: string) {
    const account = await this.getOrCreateAccount(eventId);
    this.ensureOpen(account);

    const existing = await this.prisma.monitoredDisbursement.findFirst({
      where: { id, accountId: account.id },
    });
    if (!existing) {
      throw new NotFoundException('Monitored disbursement not found');
    }

    await this.prisma.monitoredDisbursement.delete({ where: { id } });
    return { deleted: true };
  }
}
