import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as moment from 'moment';

import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';
import { Investment, InvestmentDocument } from '../investment/schemas/investment.schema';
import { SpreadsheetData, SpreadsheetDataDocument } from '../spreadsheet/schemas/spreadsheet.schema';
import { 
  DashboardResponseDto, 
  MonthlyComparisonDto, 
  BalanceEvolutionPointDto,
  CategoryExpenseDto,
  RecentTransactionDto
} from './dto/dashboard-response.dto';

const RECENT_TRANSACTIONS_LIMIT = 5;
const BALANCE_EVOLUTION_INTERVAL_DAYS = 5;
const MONTHS_FOR_AVERAGE_EXPENSES = 6;

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Investment.name) private investmentModel: Model<InvestmentDocument>,
    @InjectModel(SpreadsheetData.name) private spreadsheetModel: Model<SpreadsheetDataDocument>,
  ) {}

  async getDashboardData(userId: string): Promise<DashboardResponseDto> {
    const userObjectId = new Types.ObjectId(userId);
    const currentDate = moment.utc();
    const currentMonth = currentDate.month() + 1;
    const currentYear = currentDate.year();

    const [
      currentSpreadsheet,
      previousSpreadsheet
    ] = await Promise.all([
      this.findSpreadsheetByMonth(userObjectId, currentYear, currentMonth),
      this.findSpreadsheetByMonth(userObjectId, currentYear, currentMonth - 1),
    ]);

    const spreadsheetBalanceForToday = this.getCurrentDayBalanceFromSpreadsheet(currentSpreadsheet, currentDate);
    
    const [
      totalInvestments,
      averageExpenses,
      balanceEvolution,
      expensesByCategory,
      recentTransactions
    ] = await Promise.all([
      this.getTotalInvestments(userObjectId),
      this.getAverageMonthlyExpenses(userObjectId, currentDate),
      this.getBalanceEvolution(currentSpreadsheet, currentDate),
      this.getExpensesByCategoryForCurrentMonth(userObjectId, currentDate),
      this.getRecentTransactions(userObjectId)
    ]);

    const currentBalance = spreadsheetBalanceForToday + totalInvestments;
    const previousMonthEndBalance = (previousSpreadsheet?.monthlyProjections?.projectedBalance || 0) + totalInvestments;
    
    const monthlyIncome = currentSpreadsheet?.monthlyProjections?.totalIncome || 0;
    const monthlyExpenses = currentSpreadsheet?.monthlyProjections?.totalExpenses || 0;

    return {
      currentBalance: this.createMonthlyComparison(currentBalance, previousMonthEndBalance),
      monthlyIncome: this.createMonthlyComparison(monthlyIncome, previousSpreadsheet?.monthlyProjections?.totalIncome || 0),
      monthlyExpenses: this.createMonthlyComparison(monthlyExpenses, previousSpreadsheet?.monthlyProjections?.totalExpenses || 0),
      averageMonthlyExpenses: averageExpenses,
      balanceEvolution,
      expensesByCategory,
      recentTransactions
    };
  }

  private getCurrentDayBalanceFromSpreadsheet(
    spreadsheet: SpreadsheetDataDocument | null,
    currentDate: moment.Moment
  ): number {
    if (!spreadsheet?.dailyData?.length) {
      return 0;
    }
  
    const currentDayOfMonth = currentDate.date();
    
    const pastOrCurrentDaysData = spreadsheet.dailyData
        .filter(d => d.day <= currentDayOfMonth)
        .sort((a, b) => b.day - a.day);

    return pastOrCurrentDaysData.length > 0 ? pastOrCurrentDaysData[0].calculatedBalance : 0;
  }

  private findSpreadsheetByMonth(
    userId: Types.ObjectId,
    year: number,
    month: number
  ): Promise<SpreadsheetDataDocument | null> {
    const targetDate = moment.utc([year, month - 1]);
    return this.spreadsheetModel.findOne({
      userId,
      year: targetDate.year(),
      month: targetDate.month() + 1,
    }).exec();
  }

  private async getTotalInvestments(userId: Types.ObjectId): Promise<number> {
    const investments = await this.investmentModel.find({ userId }).exec();
    return investments.reduce((total, investment) => total + investment.balance, 0);
  }

  private async getAverageMonthlyExpenses(userId: Types.ObjectId, currentDate: moment.Moment): Promise<number> {
    const monthlyExpenses: number[] = [];
  
    for (let i = 0; i < MONTHS_FOR_AVERAGE_EXPENSES; i++) {
      const targetDate = currentDate.clone().subtract(i, 'months');
      const spreadsheet = await this.findSpreadsheetByMonth(
        userId, 
        targetDate.year(), 
        targetDate.month() + 1
      );
  
      if (spreadsheet && spreadsheet.monthlyProjections && spreadsheet.monthlyProjections.totalExpenses > 0) {
        monthlyExpenses.push(spreadsheet.monthlyProjections.totalExpenses);
      }
    }
  
    if (monthlyExpenses.length === 0) return 0;
  
    const total = monthlyExpenses.reduce((sum, expense) => sum + expense, 0);
    return total / monthlyExpenses.length;
  }
  
  private getBalanceEvolution(
    spreadsheet: SpreadsheetDataDocument | null,
    currentDate: moment.Moment
  ): BalanceEvolutionPointDto[] {
    if (!spreadsheet?.dailyData?.length) {
      return [];
    }
  
    const evolution: BalanceEvolutionPointDto[] = [];
    const currentDay = currentDate.date();
    
    for (let day = BALANCE_EVOLUTION_INTERVAL_DAYS; day <= currentDay; day += BALANCE_EVOLUTION_INTERVAL_DAYS) {
      const dayData = spreadsheet.dailyData.find(d => d.day === day);
      if (dayData) {
        evolution.push({
          date: moment([spreadsheet.year, spreadsheet.month - 1, day]).format('YYYY-MM-DD'),
          balance: dayData.calculatedBalance,
          day
        });
      }
    }
  
    const lastPointDay = evolution.length > 0 ? evolution[evolution.length - 1].day : 0;
    if (currentDay > lastPointDay) {
        const currentDayData = spreadsheet.dailyData.find(d => d.day === currentDay);
        if (currentDayData) {
          evolution.push({
            date: currentDate.format('YYYY-MM-DD'),
            balance: currentDayData.calculatedBalance,
            day: currentDay
          });
        }
    }
  
    return evolution;
  }

  private async getExpensesByCategoryForCurrentMonth(userId: Types.ObjectId, currentDate: moment.Moment): Promise<CategoryExpenseDto[]> {
    const startDate = currentDate.clone().startOf('month').toDate();
    const endDate = currentDate.clone().endOf('month').toDate();

    const expenseTransactions = await this.transactionModel.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startDate, $lte: endDate },
          $or: [
            { type: 'expense' },
            { type: 'DEBIT' }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: { $abs: '$amount' } },
        }
      },
      { $sort: { total: -1 } }
    ]).exec();

    if (expenseTransactions.length === 0) {
      return [];
    }

    const totalExpenses = expenseTransactions.reduce((sum, item) => sum + item.total, 0);

    return expenseTransactions.map((item) => ({
      category: this.formatCategoryName(item._id),
      amount: Number(item.total.toFixed(2)),
      percentage: Number(((item.total / totalExpenses) * 100).toFixed(1))
    }));
  }

  private async getRecentTransactions(userId: Types.ObjectId): Promise<RecentTransactionDto[]> {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(RECENT_TRANSACTIONS_LIMIT)
      .exec();

    return transactions.map(transaction => ({
      id: transaction._id.toString(),
      description: transaction.description || 'Sem descrição',
      category: this.formatCategoryName(transaction.category),
      amount: Math.abs(transaction.amount),
      type: this.normalizeTransactionType(transaction.type),
      date: moment(transaction.date).format('DD/MM/YYYY'),
      formattedAmount: this.formatCurrency(transaction.amount, transaction.type)
    }));
  }

  private normalizeTransactionType(type: string): 'income' | 'expense' {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('income') || lowerType === 'credit' || lowerType.includes('receita')) {
      return 'income';
    }
    
    return 'expense';
  }

  private createMonthlyComparison(
    currentValue: number, 
    previousValue: number
  ): MonthlyComparisonDto {
    const percentageChange = previousValue === 0 
      ? (currentValue > 0 ? 100 : 0)
      : Number((((currentValue - previousValue) / Math.abs(previousValue)) * 100).toFixed(1));

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(percentageChange) < 0.1) trend = 'stable';
    else if (percentageChange > 0.1) trend = 'up';
    else if (percentageChange < -0.1) trend = 'down';

    return {
      currentValue: Number(currentValue.toFixed(2)),
      previousValue: Number(previousValue.toFixed(2)),
      percentageChange: Math.abs(percentageChange),
      trend
    };
  }

  private formatCategoryName(category: string): string {
    if (!category || ['other', 'null', 'undefined'].includes(category)) {
      return 'Outros';
    }
    
    return category
      .toString()
      .split(/[_\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private formatCurrency(amount: number, type: string): string {
    const absAmount = Math.abs(amount);
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(absAmount);

    const normalizedType = this.normalizeTransactionType(type);
    return normalizedType === 'expense' ? `-${formattedAmount}` : `+${formattedAmount}`;
  }
}