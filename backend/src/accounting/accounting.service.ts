import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateIncomeEntryDto } from './dto/create-income-entry.dto';
import { CreateExpenseEntryDto } from './dto/create-expense-entry.dto';
import { UpdateIncomeEntryDto } from './dto/update-income-entry.dto';
import { UpdateExpenseEntryDto } from './dto/update-expense-entry.dto';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateAccount(eventId: string) {
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
      return event.account;
    }

    return await this.prisma.eventAccount.create({
      data: { eventId },
      include: {
        incomeEntries: true,
        expenseEntries: true,
      },
    });
  }

  async getEventAccount(eventId: string) {
    const account = await this.getOrCreateAccount(eventId);

    const totalIncome = account.incomeEntries.reduce(
      (sum, e: any) => sum + Number(e.amount || 0),
      0,
    );
    const totalExpense = account.expenseEntries.reduce(
      (sum, e: any) => sum + Number(e.amount || 0),
      0,
    );

    return {
      ...account,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense,
      },
    };
  }

  private ensureOpen(account: { isClosed: boolean }) {
    if (account.isClosed) {
      throw new BadRequestException('Account is closed');
    }
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

    return await this.prisma.expenseEntry.update({
      where: { id: entryId },
      data: {
        description: dto.description,
        amount: dto.amount as any,
        category: dto.category,
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
      },
    });
  }
}
