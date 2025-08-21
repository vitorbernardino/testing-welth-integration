import { Injectable } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { SpreadsheetService } from '../spreadsheet/spreadsheet.service';
import { EmergencyReserveService } from '../emergency-reserve/emergency-reserve.service';
import * as moment from 'moment';

@Injectable()
export class DashboardService {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly spreadsheetService: SpreadsheetService,
    private readonly emergencyReserveService: EmergencyReserveService,
  ) {}

  async getDashboardData(userId: string): Promise<any> {
    const currentMonth = moment();
    const lastMonth = moment().subtract(1, 'month');

    // Get current and previous month stats
    const [currentMonthStats, lastMonthStats, recentTransactions, emergencyReserve] = await Promise.all([
      this.transactionsService.getMonthlyStats(
        userId,
        currentMonth.year(),
        currentMonth.month() + 1,
      ),
      this.transactionsService.getMonthlyStats(
        userId,
        lastMonth.year(),
        lastMonth.month() + 1,
      ),
      this.transactionsService.getRecentTransactions(userId, 5),
      this.emergencyReserveService.findByUser(userId),
    ]);

    // Calculate current month totals
    const currentIncome = currentMonthStats.find(stat => stat._id === 'income')?.total || 0;
    const currentExpenses = currentMonthStats.find(stat => stat._id === 'expense')?.total || 0;
    const currentBalance = currentIncome - currentExpenses;

    // Calculate last month totals
    const lastIncome = lastMonthStats.find(stat => stat._id === 'income')?.total || 0;
    const lastExpenses = lastMonthStats.find(stat => stat._id === 'expense')?.total || 0;
    const lastBalance = lastIncome - lastExpenses;

    // Calculate percentage changes
    const balanceChange = this.calculatePercentageChange(lastBalance, currentBalance);
    const incomeChange = this.calculatePercentageChange(lastIncome, currentIncome);
    const expenseChange = this.calculatePercentageChange(lastExpenses, currentExpenses);

    // Calculate savings goal (percentage of income that should be saved)
    const averageIncome = await this.calculateAverageIncome(userId, 6);
    const averageExpenses = await this.transactionsService.calculateMonthlyExpenseAverage(userId, 6);
    const savingsGoal = Math.max(averageIncome * 0.2, 0); // 20% of income
    const actualSavings = currentBalance;
    const savingsProgress = savingsGoal > 0 ? (actualSavings / savingsGoal) * 100 : 0;

    // Get balance evolution chart data
    const balanceEvolution = await this.getBalanceEvolution(userId);

    // Get expense breakdown
    const expenseBreakdown = await this.getExpenseBreakdown(userId, currentMonth.year(), currentMonth.month() + 1);

    return {
      overview: {
        currentBalance: {
          value: currentBalance,
          change: balanceChange,
        },
        monthlyIncome: {
          value: currentIncome,
          change: incomeChange,
        },
        monthlyExpenses: {
          value: currentExpenses,
          change: expenseChange,
        },
        savingsGoal: {
          goal: savingsGoal,
          actual: actualSavings,
          progress: Math.min(savingsProgress, 100),
        },
      },
      charts: {
        balanceEvolution,
        expenseBreakdown,
      },
      recentTransactions,
      emergencyReserve: {
        currentAmount: emergencyReserve.currentAmount,
        targetAmount: emergencyReserve.targetAmount,
        progress: (emergencyReserve.currentAmount / emergencyReserve.targetAmount) * 100,
      },
      insights: await this.generateInsights(userId, {
        currentIncome,
        currentExpenses,
        currentBalance,
        lastBalance,
        savingsProgress,
      }),
    };
  }

  async getBalanceEvolution(userId: string): Promise<{ month: string; balance: number; income: number; expenses: number; monthBalance: number }[]> {
    const startDate = moment().subtract(11, 'months').startOf('month');
    const endDate = moment().endOf('month');

    const months: { year: number; month: number }[] = [];
    let currentDate = startDate.clone();

    while (currentDate.isSameOrBefore(endDate, 'month')) {
      months.push({
        year: currentDate.year(),
        month: currentDate.month() + 1,
      });
      currentDate.add(1, 'month');
    }

    const balanceData: any[] = [];
    let cumulativeBalance = 0;

    for (const monthData of months) {
      const monthStats = await this.transactionsService.getMonthlyStats(
        userId,
        monthData.year,
        monthData.month,
      );

      const income = monthStats.find(stat => stat._id === 'income')?.total || 0;
      const expenses = monthStats.find(stat => stat._id === 'expense')?.total || 0;
      const monthBalance = income - expenses;

      cumulativeBalance += monthBalance;

      balanceData.push({
        month: moment([monthData.year, monthData.month - 1]).format('MMM/YY'),
        balance: cumulativeBalance,
        income,
        expenses,
        monthBalance,
      });
    }

    return balanceData;
  }

  async getExpenseBreakdown(userId: string, year: number, month: number): Promise<any[]> {
    const expensesByCategory = await this.transactionsService.getMonthlyStats(userId, year, month);
    const expenseData = expensesByCategory.find(stat => stat._id === 'expense');

    if (!expenseData || !expenseData.categories) {
      return [];
    }

    // Group expenses by category
    const categoryTotals = expenseData.categories.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = 0;
      }
      acc[item.category] += item.amount;
      return acc;
    }, {});

    // Convert to array and sort by amount
    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount: amount as number,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  async generateInsights(userId: string, data: any): Promise<string[]> {
    const insights: string[] = [];

    // Balance trend insight
    if (data.currentBalance > data.lastBalance) {
      insights.push(`Parabéns! Seu saldo aumentou em relação ao mês anterior.`);
    } else if (data.currentBalance < data.lastBalance) {
      insights.push(`Atenção: seu saldo diminuiu em relação ao mês anterior.`);
    }

    // Savings goal insight
    if (data.savingsProgress >= 100) {
      insights.push(`Excelente! Você superou sua meta de economia este mês.`);
    } else if (data.savingsProgress >= 50) {
      insights.push(`Você está no caminho certo para atingir sua meta de economia.`);
    } else {
      insights.push(`Considere revisar seus gastos para atingir sua meta de economia.`);
    }

    // Expense pattern insight
    const averageExpenses = await this.transactionsService.calculateMonthlyExpenseAverage(userId, 3);
    if (data.currentExpenses > averageExpenses * 1.2) {
      insights.push(`Seus gastos este mês estão 20% acima da média. Revise suas despesas.`);
    }

    // Emergency reserve insight
    const emergencyReserve = await this.emergencyReserveService.findByUser(userId);
    const reserveProgress = (emergencyReserve.currentAmount / emergencyReserve.targetAmount) * 100;
    
    if (reserveProgress < 25) {
      insights.push(`Sua reserva de emergência está baixa. Considere aumentar seus aportes.`);
    } else if (reserveProgress >= 100) {
      insights.push(`Parabéns! Sua reserva de emergência está completa.`);
    }

    return insights;
  }

  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  }

  private async calculateAverageIncome(userId: string, months: number): Promise<number> {
    const endDate = moment();
    const startDate = endDate.clone().subtract(months, 'months');

    let totalIncome = 0;
    let monthCount = 0;

    const currentDate = startDate.clone();
    while (currentDate.isSameOrBefore(endDate, 'month')) {
      const monthStats = await this.transactionsService.getMonthlyStats(
        userId,
        currentDate.year(),
        currentDate.month() + 1,
      );

      const income = monthStats.find(stat => stat._id === 'income')?.total || 0;
      totalIncome += income;
      monthCount++;

      currentDate.add(1, 'month');
    }

    return monthCount > 0 ? totalIncome / monthCount : 0;
  }
}