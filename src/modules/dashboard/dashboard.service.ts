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

// Constantes para configuração
const RECENT_TRANSACTIONS_LIMIT = 5;
const BALANCE_EVOLUTION_INTERVAL_DAYS = 5;
const CATEGORY_ANALYSIS_MONTHS = 3;

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Investment.name) private investmentModel: Model<InvestmentDocument>,
    @InjectModel(SpreadsheetData.name) private spreadsheetModel: Model<SpreadsheetDataDocument>,
  ) {}

  /**
   * Retorna todos os dados necessários para o dashboard
   */
  async getDashboardData(userId: string): Promise<DashboardResponseDto> {
    const userObjectId = new Types.ObjectId(userId);
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Executa todas as consultas em paralelo para melhor performance
    const [
      currentBalance,
      previousBalance,
      monthlyIncome,
      previousMonthIncome,
      monthlyExpenses,
      previousMonthExpenses,
      averageExpenses,
      balanceEvolution,
      expensesByCategory,
      recentTransactions
    ] = await Promise.all([
      this.getCurrentBalance(userObjectId, currentYear, currentMonth),
      this.getPreviousMonthBalance(userObjectId, currentYear, currentMonth),
      this.getMonthlyIncomeFromSpreadsheet(userObjectId, currentYear, currentMonth),
      this.getMonthlyIncomeFromSpreadsheet(userObjectId, currentYear, currentMonth - 1),
      this.getMonthlyExpensesFromSpreadsheet(userObjectId, currentYear, currentMonth),
      this.getMonthlyExpensesFromSpreadsheet(userObjectId, currentYear, currentMonth - 1),
      this.getAverageMonthlyExpenses(userObjectId),
      this.getBalanceEvolution(userObjectId, currentYear, currentMonth),
      this.getExpensesByCategory(userObjectId),
      this.getRecentTransactions(userObjectId)
    ]);

    return {
      currentBalance: this.createMonthlyComparison(currentBalance, previousBalance),
      monthlyIncome: this.createMonthlyComparison(monthlyIncome, previousMonthIncome),
      monthlyExpenses: this.createMonthlyComparison(monthlyExpenses, previousMonthExpenses),
      averageMonthlyExpenses: averageExpenses,
      balanceEvolution,
      expensesByCategory,
      recentTransactions
    };
  }

  /**
   * Calcula o saldo atual baseado na planilha do mês atual + investimentos
   */
  private async getCurrentBalance(
    userId: Types.ObjectId, 
    currentYear: number, 
    currentMonth: number
  ): Promise<number> {
    // Busca a planilha do mês atual
    const currentSpreadsheet = await this.spreadsheetModel.findOne({
      userId,
      year: currentYear,
      month: currentMonth
    }).exec();

    let spreadsheetBalance = 0;
    
    // Primeiro tenta usar o projectedBalance das projeções mensais
    if (currentSpreadsheet?.monthlyProjections?.projectedBalance) {
      spreadsheetBalance = currentSpreadsheet.monthlyProjections.projectedBalance;
    } else if (currentSpreadsheet && currentSpreadsheet.dailyData && currentSpreadsheet.dailyData.length > 0) {
      // Fallback: usa o calculatedBalance do último dia disponível
      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      
      const availableDays = currentSpreadsheet.dailyData
        .filter(day => day.day <= currentDay)
        .sort((a, b) => b.day - a.day);
      
      if (availableDays.length > 0) {
        spreadsheetBalance = availableDays[0].calculatedBalance || 0;
      }
    }

    // Soma investimentos ativos
    const totalInvestments = await this.getTotalInvestments(userId);

    return spreadsheetBalance + totalInvestments;
  }

  /**
   * Calcula o saldo do mês anterior baseado na planilha + investimentos
   */
  private async getPreviousMonthBalance(
    userId: Types.ObjectId, 
    currentYear: number, 
    currentMonth: number
  ): Promise<number> {
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const previousSpreadsheet = await this.spreadsheetModel.findOne({
      userId,
      year: previousYear,
      month: previousMonth
    }).exec();

    let spreadsheetBalance = 0;
    if (previousSpreadsheet && previousSpreadsheet.dailyData && previousSpreadsheet.dailyData.length > 0) {
      // Pega o último dia do mês anterior
      const lastDayData = previousSpreadsheet.dailyData
        .sort((a, b) => b.day - a.day)[0];
      
      spreadsheetBalance = lastDayData?.calculatedBalance || 0;
    }

    const totalInvestments = await this.getTotalInvestments(userId);
    return spreadsheetBalance + totalInvestments;
  }

  /**
   * Calcula total de investimentos do usuário
   */
  private async getTotalInvestments(userId: Types.ObjectId): Promise<number> {
    const investments = await this.investmentModel.find({ userId }).exec();
    return investments.reduce((total, investment) => total + investment.balance, 0);
  }

  /**
   * Busca receita mensal da planilha calculada
   */
  private async getMonthlyIncomeFromSpreadsheet(
    userId: Types.ObjectId, 
    year: number, 
    month: number
  ): Promise<number> {
    // Ajusta para mês anterior se month for 0 ou negativo
    if (month <= 0) {
      month = 12 + month;
      year = year - 1;
    }

    const spreadsheet = await this.spreadsheetModel.findOne({
      userId,
      year,
      month
    }).exec();

    if (!spreadsheet || !spreadsheet.dailyData || spreadsheet.dailyData.length === 0) {
      return 0;
    }

    // Soma todas as receitas dos dias do mês
    return spreadsheet.dailyData.reduce((total, day) => total + (day.income || 0), 0);
  }

  /**
   * Busca despesas mensais da planilha calculada
   */
  private async getMonthlyExpensesFromSpreadsheet(
    userId: Types.ObjectId, 
    year: number, 
    month: number
  ): Promise<number> {
    // Ajusta para mês anterior se month for 0 ou negativo
    if (month <= 0) {
      month = 12 + month;
      year = year - 1;
    }

    const spreadsheet = await this.spreadsheetModel.findOne({
      userId,
      year,
      month
    }).exec();

    if (!spreadsheet || !spreadsheet.dailyData || spreadsheet.dailyData.length === 0) {
      return 0;
    }

    // Soma todas as despesas + gastos diários dos dias do mês
    return spreadsheet.dailyData.reduce((total, day) => 
      total + (day.expenses || 0) + (day.dailySpending || 0), 0
    );
  }

  /**
   * Calcula a média de gastos dos últimos 6 meses baseado nas planilhas
   */
  private async getAverageMonthlyExpenses(userId: Types.ObjectId): Promise<number> {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const monthlyExpenses: number[] = [];

    // Busca os últimos 6 meses
    for (let i = 0; i < 6; i++) {
      let targetMonth = currentMonth - i;
      let targetYear = currentYear;

      if (targetMonth <= 0) {
        targetMonth = 12 + targetMonth;
        targetYear = targetYear - 1;
      }

      const monthExpenses = await this.getMonthlyExpensesFromSpreadsheet(
        userId, 
        targetYear, 
        targetMonth
      );

      if (monthExpenses > 0) {
        monthlyExpenses.push(monthExpenses);
      }
    }

    if (monthlyExpenses.length === 0) return 0;

    return monthlyExpenses.reduce((sum, expense) => sum + expense, 0) / monthlyExpenses.length;
  }

  /**
   * Gera dados para o gráfico de evolução do saldo (a cada 5 dias)
   */
  private async getBalanceEvolution(
    userId: Types.ObjectId, 
    year: number, 
    month: number
  ): Promise<BalanceEvolutionPointDto[]> {
    const currentDate = new Date();
    const isCurrentMonth = year === currentDate.getFullYear() && month === currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();
    const daysInMonth = new Date(year, month, 0).getDate();

    const spreadsheet = await this.spreadsheetModel.findOne({
      userId,
      year,
      month
    }).exec();

    if (!spreadsheet || !spreadsheet.dailyData || spreadsheet.dailyData.length === 0) {
      return [];
    }

    const evolution: BalanceEvolutionPointDto[] = [];
    const maxDay = isCurrentMonth ? Math.min(currentDay, daysInMonth) : daysInMonth;
    
    // Gera pontos a cada 5 dias até o dia limite
    for (let day = 5; day <= maxDay; day += BALANCE_EVOLUTION_INTERVAL_DAYS) {
      const dayData = spreadsheet.dailyData.find(d => d.day === day);
      
      if (dayData) {
        evolution.push({
          date: moment([year, month - 1, day]).format('YYYY-MM-DD'),
          balance: dayData.calculatedBalance,
          day
        });
      }
    }

    // Adiciona o dia atual se não foi incluído e estamos no mês atual
    if (isCurrentMonth && currentDay % BALANCE_EVOLUTION_INTERVAL_DAYS !== 0 && currentDay <= daysInMonth) {
      const currentDayData = spreadsheet.dailyData.find(d => d.day === currentDay);
      if (currentDayData) {
        evolution.push({
          date: moment([year, month - 1, currentDay]).format('YYYY-MM-DD'),
          balance: currentDayData.calculatedBalance,
          day: currentDay
        });
      }
    }

    return evolution.sort((a, b) => a.day - b.day);
  }

  /**
   * Calcula gastos por categoria dos últimos 3 meses
   */
  private async getExpensesByCategory(userId: Types.ObjectId): Promise<CategoryExpenseDto[]> {
    const currentDate = new Date();
    const threeMonthsAgo = new Date(
      currentDate.getFullYear(), 
      currentDate.getMonth() - CATEGORY_ANALYSIS_MONTHS, 
      1
    );

    // Busca todas as transações de despesa dos últimos 3 meses
    const expenseTransactions = await this.transactionModel.aggregate([
      {
        $match: {
          userId,
          date: { $gte: threeMonthsAgo },
          $or: [
            { type: 'expense' },
            { type: 'DEBIT' },
            { type: { $regex: /expense/i } }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: { $abs: '$amount' } }, // Sempre valor absoluto
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      }
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

  /**
   * Busca as últimas transações
   */
  private async getRecentTransactions(userId: Types.ObjectId): Promise<RecentTransactionDto[]> {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ date: -1, createdAt: -1 }) // Ordena por data da transação, depois por criação
      .limit(RECENT_TRANSACTIONS_LIMIT)
      .exec();

    return transactions.map(transaction => ({
      id: transaction._id.toString(),
      description: transaction.description || 'Sem descrição',
      category: this.formatCategoryName(transaction.category),
      amount: Math.abs(transaction.amount), // Sempre positivo para exibição
      type: this.normalizeTransactionType(transaction.type),
      date: moment(transaction.date).format('DD/MM/YYYY'),
      formattedAmount: this.formatCurrency(transaction.amount, transaction.type)
    }));
  }

  /**
   * Normaliza tipos de transação para 'income' ou 'expense'
   */
  private normalizeTransactionType(type: string): 'income' | 'expense' {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('income') || lowerType === 'credit' || lowerType.includes('receita')) {
      return 'income';
    }
    
    return 'expense'; // Default para expense
  }

  /**
   * Cria objeto de comparação mensal
   */
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
      percentageChange: Math.abs(percentageChange), // Sempre positivo para exibição
      trend
    };
  }

  /**
   * Formata nome da categoria
   */
  private formatCategoryName(category: string): string {
    if (!category || category === 'other' || category === 'null' || category === 'undefined') {
      return 'Outros';
    }
    
    // Remove underscores e capitaliza
    return category
      .toString()
      .split(/[_\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Formata valor monetário
   */
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