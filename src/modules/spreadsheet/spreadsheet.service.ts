import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateSpreadsheetDataDto } from './dto/update-spreadsheet-data.dto';
import { CreateSpreadsheetDataDto } from './dto/create-spreadsheet-data.dto';
import * as moment from 'moment';
import { DailyData, SpreadsheetData, SpreadsheetDataDocument } from './schemas/spreadsheet.schema';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionType } from '../transactions/schemas/transaction.schema';

const DEFAULT_MONTHS_TO_GENERATE = 10;
const PRECISION_DECIMAL_PLACES = 2;

@Injectable()
export class SpreadsheetService {
  constructor(
    @InjectModel(SpreadsheetData.name) private spreadsheetModel: Model<SpreadsheetDataDocument>,
    private eventEmitter: EventEmitter2,
    private transactionsService: TransactionsService,
  ) {}

  async initializeUserSpreadsheets(userId: string): Promise<SpreadsheetData[]> {
    const currentDate = moment();
    const generatedSpreadsheets: SpreadsheetData[] = [];

    for (let monthOffset = 0; monthOffset < DEFAULT_MONTHS_TO_GENERATE; monthOffset++) {
      const targetDate = currentDate.clone().add(monthOffset, 'months');
      const year = targetDate.year();
      const month = targetDate.month() + 1;

      const existingSpreadsheet = await this.findByUserAndMonthOptional(userId, year, month);
      
      if (!existingSpreadsheet) {
        const spreadsheetData = await this.createEmptyMonthSpreadsheet(userId, year, month);
        generatedSpreadsheets.push(spreadsheetData);
      } else {
        console.log(`📅 Planilha já existe para ${year}/${month}`);
      }
    }

    return generatedSpreadsheets;
  }

  async addNextMonth(userId: string): Promise<SpreadsheetData> {
    const lastSpreadsheet = await this.getLastSpreadsheetForUser(userId);
    
    let nextYear: number;
    let nextMonth: number;

    if (lastSpreadsheet) {
      const lastDate = moment([lastSpreadsheet.year, lastSpreadsheet.month - 1]);
      const nextDate = lastDate.add(1, 'month');
      nextYear = nextDate.year();
      nextMonth = nextDate.month() + 1;
    } else {
      const currentDate = moment();
      nextYear = currentDate.year();
      nextMonth = currentDate.month() + 1;
    }

    const existingSpreadsheet = await this.findByUserAndMonthOptional(userId, nextYear, nextMonth);
    if (existingSpreadsheet) {
      return existingSpreadsheet;
    }

    return this.createEmptyMonthSpreadsheet(userId, nextYear, nextMonth);
  }

  private async createEmptyMonthSpreadsheet(
    userId: string, 
    year: number, 
    month: number
  ): Promise<SpreadsheetData> {
    const daysInMonth = moment([year, month - 1]).daysInMonth();
    const dailyData: DailyData[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      dailyData.push({
        day,
        income: 0,
        expenses: 0,
        dailySpending: 0,
        balance: 0,
        calculatedBalance: 0,
      } as DailyData);
    }

    const createData: CreateSpreadsheetDataDto = {
      year,
      month,
      dailyData,
      monthlyProjections: {
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        projectedBalance: 0,
      },
    };

    const createdSpreadsheet = await this.create(userId, createData);
    
    // Emite evento para recalcular com base em transações existentes
    this.eventEmitter.emit('spreadsheet.month.created', {
      userId,
      year,
      month,
      spreadsheet: createdSpreadsheet
    });

    return createdSpreadsheet;
  }

  private async getLastSpreadsheetForUser(userId: string): Promise<SpreadsheetData | null> {
    return this.spreadsheetModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ year: -1, month: -1 })
      .exec();
  }

  private async findByUserAndMonthOptional(
    userId: string,
    year: number,
    month: number,
  ): Promise<SpreadsheetData | null> {
    return this.spreadsheetModel.findOne({
      userId: new Types.ObjectId(userId),
      year,
      month,
    });
  }

  async create(userId: string, createSpreadsheetDataDto: CreateSpreadsheetDataDto): Promise<SpreadsheetData> {
    const spreadsheetData = new this.spreadsheetModel({
      ...createSpreadsheetDataDto,
      userId: new Types.ObjectId(userId),
    });

    return spreadsheetData.save();
  }

  async findByUserAndMonth(
    userId: string,
    year: number,
    month: number,
  ): Promise<SpreadsheetData> {
    const spreadsheetData = await this.findByUserAndMonthOptional(userId, year, month);

    if (!spreadsheetData) {
      throw new NotFoundException('Spreadsheet data not found for this month');
    }

    return spreadsheetData;
  }

  async findByUserAndDateRange(
    userId: string,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
  ): Promise<SpreadsheetData[]> {
    const startDate = moment([startYear, startMonth - 1, 1]);
    const endDate = moment([endYear, endMonth - 1, 1]).endOf('month');

    return this.spreadsheetModel.find({
      userId: new Types.ObjectId(userId),
      $expr: {
        $and: [
          {
            $gte: [
              { $dateFromParts: { year: '$year', month: '$month', day: 1 } },
              startDate.toDate(),
            ],
          },
          {
            $lte: [
              { $dateFromParts: { year: '$year', month: '$month', day: 1 } },
              endDate.toDate(),
            ],
          },
        ],
      },
    }).sort({ year: 1, month: 1 });
  }

  async getAllUserSpreadsheets(userId: string): Promise<SpreadsheetData[]> {
    return this.spreadsheetModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ year: 1, month: 1 })
      .exec();
  }

  async getNext10Months(userId: string): Promise<SpreadsheetData[]> {
    return this.getAllUserSpreadsheets(userId);
  }

  async update(
    userId: string,
    year: number,
    month: number,
    updateSpreadsheetDataDto: UpdateSpreadsheetDataDto,
  ): Promise<SpreadsheetData> {
    const updatedSpreadsheet = await this.spreadsheetModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        year,
        month,
      },
      updateSpreadsheetDataDto,
      { new: true, upsert: true },
    );

    if (!updatedSpreadsheet) {
      throw new NotFoundException('Spreadsheet data not found');
    }

    return updatedSpreadsheet;
  }

  async updateDayData(
    userId: string,
    year: number,
    month: number,
    day: number,
    dayData: Partial<{
      income: number;
      expenses: number;
      dailySpending: number;
      balance: number;
    }>,
  ): Promise<SpreadsheetData> {
    let spreadsheet = await this.findByUserAndMonthOptional(userId, year, month);
  
    if (!spreadsheet) {
      spreadsheet = await this.createEmptyMonthSpreadsheet(userId, year, month);
    }
  
    const dayIndex = spreadsheet.dailyData.findIndex(dailyRecord => dailyRecord.day === day);
    let previousDayData: DailyData | null = null;
  
    if (dayIndex >= 0) {
      previousDayData = { ...spreadsheet.dailyData[dayIndex] };
      Object.assign(spreadsheet.dailyData[dayIndex], {
        income: dayData.income !== undefined ? Number(dayData.income.toFixed(PRECISION_DECIMAL_PLACES)) : spreadsheet.dailyData[dayIndex].income,
        expenses: dayData.expenses !== undefined ? Number(dayData.expenses.toFixed(PRECISION_DECIMAL_PLACES)) : spreadsheet.dailyData[dayIndex].expenses,
        dailySpending: dayData.dailySpending !== undefined ? Number(dayData.dailySpending.toFixed(PRECISION_DECIMAL_PLACES)) : spreadsheet.dailyData[dayIndex].dailySpending,
        balance: dayData.balance !== undefined ? Number(dayData.balance.toFixed(PRECISION_DECIMAL_PLACES)) : spreadsheet.dailyData[dayIndex].balance,
      });
    } else {
      const newDayData: DailyData = {
        day,
        income: dayData.income ? Number(dayData.income.toFixed(PRECISION_DECIMAL_PLACES)) : 0,
        expenses: dayData.expenses ? Number(dayData.expenses.toFixed(PRECISION_DECIMAL_PLACES)) : 0,
        dailySpending: dayData.dailySpending ? Number(dayData.dailySpending.toFixed(PRECISION_DECIMAL_PLACES)) : 0,
        balance: dayData.balance ? Number(dayData.balance.toFixed(PRECISION_DECIMAL_PLACES)) : 0,
        calculatedBalance: 0,
      };
      spreadsheet.dailyData.push(newDayData);
      
      spreadsheet.dailyData.sort((a, b) => a.day - b.day);
    }
  
    await this.recalculateMonthlyBalances(spreadsheet);
  
    const savedSpreadsheet = await (spreadsheet as any).save();
  
    // Criar uma transação “other” para income/expenses editados diretamente na planilha
    const targetDate = moment.utc([year, month - 1, day]).format('YYYY-MM-DD');
  
    if (dayData.income !== undefined) {
      const amount = Number(dayData.income.toFixed(PRECISION_DECIMAL_PLACES));
      if (amount > 0) {
        await this.transactionsService.create(userId, {
          type: TransactionType.INCOME,
          category: 'other',
          amount,
          date: targetDate,
          description: 'Criado pela edição da planilha',
        } as any);
      }
    }
  
    if (dayData.expenses !== undefined) {
      const amount = Number(dayData.expenses.toFixed(PRECISION_DECIMAL_PLACES));
      if (amount > 0) {
        await this.transactionsService.create(userId, {
          type: TransactionType.EXPENSE,
          category: 'other',
          amount,
          date: targetDate,
          description: 'Criado pela edição da planilha',
        } as any);
      }
    }
  
    this.eventEmitter.emit('spreadsheet.day.updated', {
      userId,
      year,
      month,
      day,
      dayData: savedSpreadsheet.dailyData.find(d => d.day === day),
      previousDayData,
    });
  
    if (!savedSpreadsheet) {
      throw new NotFoundException('Spreadsheet data not found');
    }
  
    return savedSpreadsheet;
  }

  async recalculateMonthlyBalances(spreadsheet: SpreadsheetData): Promise<void> {
    spreadsheet.dailyData.sort((a, b) => a.day - b.day);

    let accumulatedBalance = await this.getPreviousMonthFinalBalance(
      spreadsheet.userId.toString(), 
      spreadsheet.year, 
      spreadsheet.month
    );

    for (const dailyRecord of spreadsheet.dailyData) {
      const dailyNetFlow = dailyRecord.income - dailyRecord.expenses - dailyRecord.dailySpending;
      dailyRecord.balance = Number(dailyNetFlow.toFixed(PRECISION_DECIMAL_PLACES));
      
      accumulatedBalance += dailyNetFlow;
      dailyRecord.calculatedBalance = Number(accumulatedBalance.toFixed(PRECISION_DECIMAL_PLACES));
    }

    this.updateMonthlyProjections(spreadsheet);
  }

  private async getPreviousMonthFinalBalance(
    userId: string, 
    currentYear: number, 
    currentMonth: number
  ): Promise<number> {
    const currentDate = moment([currentYear, currentMonth - 1, 1]);
    const previousDate = currentDate.clone().subtract(1, 'month');
    
    const previousYear = previousDate.year();
    const previousMonth = previousDate.month() + 1;

    const previousSpreadsheet = await this.findByUserAndMonthOptional(
      userId, 
      previousYear, 
      previousMonth
    );

    if (!previousSpreadsheet || previousSpreadsheet.dailyData.length === 0) {
      return 0;
    }

    return previousSpreadsheet.monthlyProjections.projectedBalance || 0;
  }

  private updateMonthlyProjections(spreadsheet: SpreadsheetData): void {
    const totalIncome = spreadsheet.dailyData.reduce(
      (sum, day) => sum + day.income, 0
    );
    const totalExpenses = spreadsheet.dailyData.reduce(
      (sum, day) => sum + day.expenses + day.dailySpending, 0
    );

    const lastDay = spreadsheet.dailyData.length > 0 
      ? spreadsheet.dailyData[spreadsheet.dailyData.length - 1] 
      : null;

    spreadsheet.monthlyProjections = {
      totalIncome: Number(totalIncome.toFixed(PRECISION_DECIMAL_PLACES)),
      totalExpenses: Number(totalExpenses.toFixed(PRECISION_DECIMAL_PLACES)),
      netBalance: Number((totalIncome - totalExpenses).toFixed(PRECISION_DECIMAL_PLACES)),
      projectedBalance: lastDay ? lastDay.calculatedBalance : 0,
    };
  }

  async delete(userId: string, year: number, month: number): Promise<boolean> {
    const result = await this.spreadsheetModel.deleteOne({
      userId: new Types.ObjectId(userId),
      year,
      month,
    });

    return result.deletedCount > 0;
  }

  async getYearlyOverview(userId: string, year: number): Promise<any> {
    const yearlyData = await this.spreadsheetModel.find({
      userId: new Types.ObjectId(userId),
      year,
    }).sort({ month: 1 });

    const monthlyTotals = yearlyData.map(monthData => ({
      month: monthData.month,
      totalIncome: monthData.monthlyProjections.totalIncome,
      totalExpenses: monthData.monthlyProjections.totalExpenses,
      netBalance: monthData.monthlyProjections.netBalance,
    }));

    const yearTotals = {
      totalIncome: yearlyData.reduce(
        (sum, monthData) => sum + monthData.monthlyProjections.totalIncome, 0
      ),
      totalExpenses: yearlyData.reduce(
        (sum, monthData) => sum + monthData.monthlyProjections.totalExpenses, 0
      ),
      averageMonthlyIncome: monthlyTotals.length > 0 ? 
        Number((monthlyTotals.reduce((sum, monthData) => sum + monthData.totalIncome, 0) / monthlyTotals.length).toFixed(PRECISION_DECIMAL_PLACES)) : 0,
      averageMonthlyExpenses: monthlyTotals.length > 0 ? 
        Number((monthlyTotals.reduce((sum, monthData) => sum + monthData.totalExpenses, 0) / monthlyTotals.length).toFixed(PRECISION_DECIMAL_PLACES)) : 0,
    };

    return {
      year,
      monthlyTotals,
      yearTotals,
    };
  }
}