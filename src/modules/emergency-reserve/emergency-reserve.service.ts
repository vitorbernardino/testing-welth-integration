import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmergencyReserve, EmergencyReserveDocument, InvestmentType } from './schemas/emergency-reserve.schema';
import { CreateEmergencyReserveDto } from './dto/create-emergency-reserve.dto';
import { UpdateEmergencyReserveDto } from './dto/update-emergency-reserve.dto';
import { AddInvestmentDto } from './dto/add-investment.dto';
import { ReserveTransactionDto } from './dto/reserve-transaction.dto';
import { TransactionsService } from '../transactions/transactions.service';

interface ProjectionData {
  month: number;
  date: Date;
  totalValue: number;
  cashAmount: number;
  investmentValue: number;
  monthlyContribution: number;
  progressPercentage: number;
  targetReached: boolean;
}

@Injectable()
export class EmergencyReserveService {
  constructor(
    @InjectModel(EmergencyReserve.name) private emergencyReserveModel: Model<EmergencyReserveDocument>,
    private transactionsService: TransactionsService,
  ) {}

  async create(userId: string, createEmergencyReserveDto: CreateEmergencyReserveDto): Promise<EmergencyReserve> {
    const existingReserve = await this.emergencyReserveModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (existingReserve) {
      return this.update(userId, createEmergencyReserveDto);
    }

    const emergencyReserve = new this.emergencyReserveModel({
      ...createEmergencyReserveDto,
      userId: new Types.ObjectId(userId),
    });

    return emergencyReserve.save();
  }

  async findByUser(userId: string): Promise<EmergencyReserve> {
    let reserve = await this.emergencyReserveModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!reserve) {
      throw new NotFoundException('Emergency reserve not found');
    }

    return reserve;
  }

  async update(userId: string, updateEmergencyReserveDto: UpdateEmergencyReserveDto): Promise<EmergencyReserve> {
    const reserve = await this.emergencyReserveModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      updateEmergencyReserveDto,
      { new: true, upsert: true },
    );

    if (!reserve) {
      throw new NotFoundException('Emergency reserve not found');
    }

    // Recalculate target amount if target months or monthly expenses changed
    if (updateEmergencyReserveDto.targetMonths || updateEmergencyReserveDto.monthlyExpenses) {
      const targetAmount = (updateEmergencyReserveDto.monthlyExpenses || reserve.monthlyExpenses) *
        (updateEmergencyReserveDto.targetMonths || reserve.targetMonths);
      
      reserve.targetAmount = targetAmount;
      await reserve.save();
    }

    return reserve;
  }

  async addMoney(userId: string, transactionDto: ReserveTransactionDto): Promise<EmergencyReserve> {
    const reserve = await this.findByUser(userId);

    reserve.currentAmount += transactionDto.amount;
    reserve.transactions.push({
      type: 'deposit',
      amount: transactionDto.amount,
      description: transactionDto.description,
      date: new Date(),
    });

    const updatedReserve = await this.emergencyReserveModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { 
        currentAmount: reserve.currentAmount,
        transactions: reserve.transactions 
      },
      { new: true }
    );

    if (!updatedReserve) {
      throw new NotFoundException('Emergency reserve not found');
    }

    return updatedReserve;
  }

  async removeMoney(userId: string, transactionDto: ReserveTransactionDto): Promise<EmergencyReserve> {
    const reserve = await this.findByUser(userId);

    if (reserve.currentAmount < transactionDto.amount) {
      throw new Error('Insufficient funds in emergency reserve');
    }

    reserve.currentAmount -= transactionDto.amount;
    reserve.transactions.push({
      type: 'withdrawal',
      amount: transactionDto.amount,
      description: transactionDto.description,
      date: new Date(),
    });

    const updatedReserve = await this.emergencyReserveModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { 
        currentAmount: reserve.currentAmount,
        transactions: reserve.transactions 
      },
      { new: true }
    );

    if (!updatedReserve) {
      throw new NotFoundException('Emergency reserve not found');
    }

    return updatedReserve;
  }

  async addInvestment(userId: string, addInvestmentDto: AddInvestmentDto): Promise<EmergencyReserve> {
    const reserve = await this.findByUser(userId);

    if (reserve.currentAmount < addInvestmentDto.amount) {
      throw new Error('Insufficient funds for investment');
    }

    const investment = {
      type: addInvestmentDto.type,
      name: addInvestmentDto.name,
      amount: addInvestmentDto.amount,
      annualRate: addInvestmentDto.annualRate,
      investedAt: new Date(),
    };

    reserve.investments.push(investment);
    reserve.currentAmount -= addInvestmentDto.amount;

    const updatedReserve = await this.emergencyReserveModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { 
        currentAmount: reserve.currentAmount,
        investments: reserve.investments 
      },
      { new: true }
    );

    if (!updatedReserve) {
      throw new NotFoundException('Emergency reserve not found');
    }

    return updatedReserve;
  }

  async removeInvestment(userId: string, investmentIndex: number): Promise<EmergencyReserve> {
    const reserve = await this.findByUser(userId);

    if (investmentIndex < 0 || investmentIndex >= reserve.investments.length) {
      throw new NotFoundException('Investment not found');
    }

    const investment = reserve.investments[investmentIndex];
    const currentValue = this.calculateInvestmentCurrentValue(investment);

    reserve.currentAmount += currentValue;
    reserve.investments.splice(investmentIndex, 1);

    const updatedReserve = await this.emergencyReserveModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { 
        currentAmount: reserve.currentAmount,
        investments: reserve.investments 
      },
      { new: true }
    );

    if (!updatedReserve) {
      throw new NotFoundException('Emergency reserve not found');
    }

    return updatedReserve;
  }

  async getProjections(userId: string, months: number = 12): Promise<any> {
    const reserve = await this.findByUser(userId);

    const projections: ProjectionData[] = [];
    let currentAmount = reserve.currentAmount;
    let totalInvested = reserve.investments.reduce((sum, inv) => sum + inv.amount, 0);

    for (let month = 0; month <= months; month++) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() + month);

      // Calculate investment growth
      const investmentValue = reserve.investments.reduce((total, investment) => {
        const monthsInvested = month + this.getMonthsDifference(investment.investedAt, new Date());
        const monthlyRate = investment.annualRate / 100 / 12;
        return total + (investment.amount * Math.pow(1 + monthlyRate, monthsInvested));
      }, 0);

      // Add monthly contributions
      const monthlyContribution = month > 0 ? reserve.suggestedMonthlyContribution : 0;
      currentAmount += monthlyContribution;

      const totalValue = currentAmount + investmentValue;
      const progressPercentage = (totalValue / reserve.targetAmount) * 100;

      const projectionData: ProjectionData = {
        month: month,
        date: monthDate,
        totalValue: Math.round(totalValue * 100) / 100,
        cashAmount: Math.round(currentAmount * 100) / 100,
        investmentValue: Math.round(investmentValue * 100) / 100,
        monthlyContribution,
        progressPercentage: Math.min(progressPercentage, 100),
        targetReached: totalValue >= reserve.targetAmount,
      };

      projections.push(projectionData);
    }

    return {
      reserve,
      projections,
      summary: {
        monthsToTarget: projections.findIndex(p => p.targetReached) || months,
        totalGrowth12Months: projections[12]?.totalValue - reserve.currentAmount - totalInvested || 0,
        averageMonthlyGrowth: projections[12] ? 
          (projections[12].totalValue - reserve.currentAmount - totalInvested) / 12 : 0,
      },
    };
  }

  async getReserveStats(userId: string): Promise<any> {
    const reserve = await this.findByUser(userId);

    const totalInvested = reserve.investments.reduce((sum, inv) => sum + inv.amount, 0);
    const currentInvestmentValue = reserve.investments.reduce((sum, inv) => 
      sum + this.calculateInvestmentCurrentValue(inv), 0);
    
    const totalReserve = reserve.currentAmount + currentInvestmentValue;
    const progressPercentage = (totalReserve / reserve.targetAmount) * 100;

    const last30DaysTransactions = reserve.transactions.filter(t => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(t.date) >= thirtyDaysAgo;
    });

    const monthlyDeposits = last30DaysTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyWithdrawals = last30DaysTransactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      currentAmount: reserve.currentAmount,
      totalInvested,
      currentInvestmentValue,
      totalReserve,
      targetAmount: reserve.targetAmount,
      progressPercentage: Math.min(progressPercentage, 100),
      monthlyExpenses: reserve.monthlyExpenses,
      targetMonths: reserve.targetMonths,
      suggestedMonthlyContribution: reserve.suggestedMonthlyContribution,
      monthlyDeposits,
      monthlyWithdrawals,
      monthsOfExpensesCovered: reserve.monthlyExpenses > 0 ? totalReserve / reserve.monthlyExpenses : 0,
      investmentBreakdown: reserve.investments.map(inv => ({
        type: inv.type,
        name: inv.name,
        originalAmount: inv.amount,
        currentValue: this.calculateInvestmentCurrentValue(inv),
        annualRate: inv.annualRate,
        monthsInvested: this.getMonthsDifference(inv.investedAt, new Date()),
      })),
    };
  }

  private calculateInvestmentCurrentValue(investment: any): number {
    const monthsInvested = this.getMonthsDifference(investment.investedAt, new Date());
    const monthlyRate = investment.annualRate / 100 / 12;
    return investment.amount * Math.pow(1 + monthlyRate, monthsInvested);
  }

  private getMonthsDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }
}