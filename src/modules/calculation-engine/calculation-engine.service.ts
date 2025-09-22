import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';
import * as moment from 'moment';
import { DailyData, SpreadsheetData, SpreadsheetDataDocument } from '../spreadsheet/schemas/spreadsheet.schema';

const DEFAULT_PROJECTION_MONTHS = 10;
const RECURRING_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly', 
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
} as const;
const DATE_FORMAT = 'YYYY-MM-DD';

@Injectable()
export class CalculationEngineService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(SpreadsheetData.name) private spreadsheetModel: Model<SpreadsheetDataDocument>,
  ) {}

  @OnEvent('transaction.created')
  async handleTransactionCreated(payload: { userId: string; transaction: Transaction }) {
    await this.recalculateAffectedSpreadsheets(payload.userId, payload.transaction.date);

    if (payload.transaction.isRecurring && payload.transaction.recurringPattern?.isActive) {
      await this.recalculateRecurringHorizon(payload.userId, payload.transaction.date);
    }
  }

  @OnEvent('transaction.updated') 
  async handleTransactionUpdated(payload: { userId: string; transaction: Transaction; previousDate?: Date }) {
    await this.recalculateAffectedSpreadsheets(payload.userId, payload.transaction.date);
    
    if (payload.previousDate && 
        moment.utc(payload.previousDate).format('YYYY-MM') !== moment.utc(payload.transaction.date).format('YYYY-MM')) {
      await this.recalculateAffectedSpreadsheets(payload.userId, payload.previousDate);
    }
  }

  @OnEvent('transaction.deleted')
  async handleTransactionDeleted(payload: { userId: string; transactionId: string; date?: Date }) {
    if (payload.date) {
      await this.recalculateAffectedSpreadsheets(payload.userId, payload.date);
    } else {
      await this.recalculateAllUserSpreadsheets(payload.userId);
    }
  }

  @OnEvent('spreadsheet.month.created')
  async handleSpreadsheetMonthCreated(payload: { userId: string; year: number; month: number }) {
    await this.calculateMonthlySpreadsheet(payload.userId, payload.year, payload.month);
  }

  @OnEvent('spreadsheet.day.updated')
  async handleSpreadsheetDayUpdated(payload: {
    userId: string;
    year: number;
    month: number; 
    day: number;
    dayData: DailyData;
    previousDayData: DailyData | null;
  }) {
    const targetDate = moment.utc([payload.year, payload.month - 1, payload.day]).toDate();
    await this.recalculateAffectedSpreadsheets(payload.userId, targetDate);
  }

  private async recalculateAffectedSpreadsheets(userId: string, affectedDate: Date): Promise<void> {
    const targetMoment = moment.utc(affectedDate);
    const year = targetMoment.year();
    const month = targetMoment.month() + 1;

    await this.calculateMonthlySpreadsheet(userId, year, month);

    await this.recalculateSubsequentMonths(userId, year, month);
  }

  private async recalculateSubsequentMonths(userId: string, fromYear: number, fromMonth: number): Promise<void> {
    const userSpreadsheets = await this.spreadsheetModel
      .find({ 
        userId: new Types.ObjectId(userId),
        $or: [
          { year: { $gt: fromYear } },
          { year: fromYear, month: { $gt: fromMonth } }
        ]
      })
      .sort({ year: 1, month: 1 });

    for (const spreadsheet of userSpreadsheets) {
      await this.calculateMonthlySpreadsheet(userId, spreadsheet.year, spreadsheet.month);
    }
  }

  async recalculateAllUserSpreadsheets(userId: string): Promise<void> {
    const userSpreadsheets = await this.spreadsheetModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ year: 1, month: 1 });

    for (const spreadsheet of userSpreadsheets) {
      await this.calculateMonthlySpreadsheet(userId, spreadsheet.year, spreadsheet.month);
    }
  }

  private async calculateMonthlySpreadsheet(userId: string, year: number, month: number): Promise<void> {
    const startDateUtc = moment.utc([year, month - 1, 1]);
    const endDateUtc = startDateUtc.clone().endOf('month');
    const daysInMonth = endDateUtc.date();

    const actualTransactions = await this.getMonthTransactions(userId, startDateUtc, endDateUtc);

    const projectedTransactions = await this.getProjectedRecurringTransactions(userId, year, month);

    const allTransactions = [...actualTransactions, ...projectedTransactions];

    const transactionsByDay = this.groupTransactionsByDay(allTransactions);

    const existingDailySpending = await this.getExistingDailySpendingMap(userId, year, month);

    const dailyData: DailyData[] = [];
    let cumulativeBalance = await this.getPreviousMonthFinalBalance(userId, year, month);

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDateUtc = moment.utc([year, month - 1, day]);
      const dayKey = dayDateUtc.format(DATE_FORMAT);
      const dayTransactions = transactionsByDay.get(dayKey) || [];

      const dayIncome = this.calculateDayIncome(dayTransactions);
      const dayExpenses = this.calculateDayExpenses(dayTransactions);
      const dayDailySpending = existingDailySpending.get(day) ?? 0;

      const dailyNetFlow = dayIncome - dayExpenses - dayDailySpending;
      cumulativeBalance += dailyNetFlow;

      const dayData: DailyData = {
        day,
        income: Number(dayIncome.toFixed(2)),
        expenses: Number(dayExpenses.toFixed(2)),
        dailySpending: Number(dayDailySpending.toFixed(2)),
        balance: Number(dailyNetFlow.toFixed(2)),
        calculatedBalance: Number(cumulativeBalance.toFixed(2)),
      };

      dailyData.push(dayData);
    }

    const monthlyProjections = this.calculateMonthlyProjections(dailyData, cumulativeBalance);

    await this.updateSpreadsheetData(userId, year, month, dailyData, monthlyProjections);
  }

  private async getMonthTransactions(
    userId: string, 
    startDateUtc: moment.Moment, 
    endDateUtc: moment.Moment
  ): Promise<Transaction[]> {
    return this.transactionModel.find({
      userId: new Types.ObjectId(userId),
      isRecurring: false,
      date: {
        $gte: startDateUtc.toDate(),
        $lte: endDateUtc.toDate(),
      },
    }).sort({ date: 1 });
  }

  private groupTransactionsByDay(transactions: Transaction[]): Map<string, Transaction[]> {
    const map = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const dayKey = moment.utc(transaction.date).format(DATE_FORMAT);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(transaction);
    }
    return map;
  }

  private async getExistingDailySpendingMap(
    userId: string,
    year: number,
    month: number
  ): Promise<Map<number, number>> {
    const existing = await this.spreadsheetModel.findOne({
      userId: new Types.ObjectId(userId),
      year,
      month,
    });

    const map = new Map<number, number>();
    if (!existing || !Array.isArray(existing.dailyData)) return map;

    for (const dayRecord of existing.dailyData) {
      map.set(dayRecord.day, dayRecord.dailySpending ?? 0);
    }
    return map;
  }

  private calculateDayIncome(dayTransactions: Transaction[]): number {
    return dayTransactions
      .filter(transaction => transaction.type === 'income' || transaction.type === 'CREDIT' && transaction.category !== 'Credit card payment')
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }
  
  private calculateDayExpenses(dayTransactions: Transaction[]): number {
    return dayTransactions
      .filter(transaction => transaction.type === 'expense' || transaction.type === 'DEBIT' || transaction.category === 'Credit card payment')
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }

  private calculateMonthlyProjections(dailyData: DailyData[], finalBalance: number) {
    const totalIncome = dailyData.reduce((sum, day) => sum + day.income, 0);
    const totalExpenses = dailyData.reduce((sum, day) => sum + (day.expenses + day.dailySpending), 0);

    return {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netBalance: Number((totalIncome - totalExpenses).toFixed(2)),
      projectedBalance: Number(finalBalance.toFixed(2)),
    };
  }

  private async updateSpreadsheetData(
    userId: string,
    year: number,
    month: number,
    dailyData: DailyData[],
    monthlyProjections: any
  ): Promise<void> {
    await this.spreadsheetModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), year, month },
      {
        $set: { dailyData, monthlyProjections },
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          year,
          month,
        },
      },
      { upsert: true, new: true }
    );
  }

  private async getPreviousMonthFinalBalance(userId: string, year: number, month: number): Promise<number> {
    let previousYear = year;
    let previousMonth = month - 1;

    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear--;
    }

    const previousSpreadsheet = await this.spreadsheetModel.findOne({
      userId: new Types.ObjectId(userId),
      year: previousYear,
      month: previousMonth,
    });

    if (!previousSpreadsheet) {
      return 0;
    }

    return previousSpreadsheet.monthlyProjections?.projectedBalance ?? 0;
  }

  private async getProjectedRecurringTransactions(
    userId: string,
    year: number,
    month: number
  ): Promise<Transaction[]> {
    const recurringTransactions = await this.transactionModel.find({
      userId: new Types.ObjectId(userId),
      isRecurring: true,
      'recurringPattern.isActive': true,
    });

    const projectedTransactions: Transaction[] = [];
    const startDateUtc = moment.utc([year, month - 1, 1]);
    const endDateUtc = startDateUtc.clone().endOf('month');

    for (const recurringTransaction of recurringTransactions) {
      const pattern = recurringTransaction.recurringPattern;
      if (!pattern) continue;

      if (pattern.frequency === RECURRING_FREQUENCY.MONTHLY && pattern.dayOfMonth) {
        const projectedTransaction = await this.createMonthlyProjectedTransaction(
          recurringTransaction, year, month, pattern.dayOfMonth, startDateUtc, endDateUtc
        );
        
        if (projectedTransaction) {
          projectedTransactions.push(projectedTransaction);
        }
      }
      // TODO: Implementar outras frequências (weekly, daily, yearly) conforme necessário
    }

    return projectedTransactions;
  }

   private async createMonthlyProjectedTransaction(
    recurringTransaction: Transaction,
    year: number,
    month: number,
    dayOfMonth: number,
    startDateUtc: moment.Moment,
    endDateUtc: moment.Moment
  ): Promise<Transaction | null> {
    const transactionDateUtc = moment.utc([year, month - 1, dayOfMonth]);
    
    if (!transactionDateUtc.isBetween(startDateUtc, endDateUtc, null, '[]')) {
      return null;
    }

    const existingTransaction = await this.transactionModel.findOne({
      userId: recurringTransaction.userId,
      parentTransactionId: recurringTransaction._id,
      date: {
        $gte: transactionDateUtc.clone().startOf('day').toDate(),
        $lte: transactionDateUtc.clone().endOf('day').toDate(),
      },
    });

    if (existingTransaction) {
      return null;
    }

    return {
      userId: recurringTransaction.userId,
      type: recurringTransaction.type,
      category: recurringTransaction.category,
      amount: recurringTransaction.amount,
      date: transactionDateUtc.toDate(),
      description: `${recurringTransaction.description ?? ''} (Projetado)`.trim(),
      source: 'projected',
      parentTransactionId: recurringTransaction._id,
      isRecurring: false,
    } as unknown as Transaction;
  }

  async calculateMonthlyExpenseAverage(userId: string, months: number = 6): Promise<number> {
    const endDate = moment.utc();
    const startDate = endDate.clone().subtract(months, 'months');

    const transactions = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: { $in: ['expense', 'DEBIT'] },
          date: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate(),
          },
        },
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: { $abs: '$amount' } },
        },
      },
    ]);

    if (transactions.length === 0) return 0;

    return transactions[0].totalExpenses / months;
  }

  async getExpensesByCategory(userId: string, year: number, month: number) {
    const startDate = moment.utc([year, month - 1, 1]);
    const endDate = startDate.clone().endOf('month');

    return this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: { $in: ['expense', 'DEBIT'] },
          date: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate(),
          },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: { $abs: '$amount' } },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);
  }

  private async recalculateRecurringHorizon(userId: string, fromDate: Date): Promise<void> {
    const startOfFromMonth = moment.utc(fromDate).startOf('month');
    for (let monthOffset = 1; monthOffset <= DEFAULT_PROJECTION_MONTHS; monthOffset++) {
      const targetDate = startOfFromMonth.clone().add(monthOffset, 'months');
      const targetYear = targetDate.year();
      const targetMonth = targetDate.month() + 1;
      await this.calculateMonthlySpreadsheet(userId, targetYear, targetMonth);
    }
  }
}