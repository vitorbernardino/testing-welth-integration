import { IsNumber, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para métricas de comparação mensal
 */
export class MonthlyComparisonDto {
  @IsNumber()
  currentValue: number;

  @IsNumber()
  previousValue: number;

  @IsNumber()
  percentageChange: number;

  @IsString()
  trend: 'up' | 'down' | 'stable';
}

/**
 * DTO para pontos do gráfico de evolução do saldo
 */
export class BalanceEvolutionPointDto {
  @IsString()
  date: string; // formato YYYY-MM-DD

  @IsNumber()
  balance: number;

  @IsNumber()
  day: number;
}

/**
 * DTO para gastos por categoria
 */
export class CategoryExpenseDto {
  @IsString()
  category: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  percentage: number;
}

/**
 * DTO para transações recentes
 */
export class RecentTransactionDto {
  @IsString()
  id: string;

  @IsString()
  description: string;

  @IsString()
  category: string;

  @IsNumber()
  amount: number;

  @IsString()
  type: 'income' | 'expense';

  @IsString()
  date: string;

  @IsString()
  formattedAmount: string; // valor formatado com R$
}

/**
 * DTO principal de resposta do dashboard
 */
export class DashboardResponseDto {
  // Saldo atual com comparação mensal
  @ValidateNested()
  @Type(() => MonthlyComparisonDto)
  currentBalance: MonthlyComparisonDto;

  // Entradas do mês com comparação
  @ValidateNested()
  @Type(() => MonthlyComparisonDto)
  monthlyIncome: MonthlyComparisonDto;

  // Gastos do mês com comparação
  @ValidateNested()
  @Type(() => MonthlyComparisonDto)
  monthlyExpenses: MonthlyComparisonDto;

  // Média de gastos mensais
  @IsNumber()
  averageMonthlyExpenses: number;

  // Evolução do saldo (gráfico)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceEvolutionPointDto)
  balanceEvolution: BalanceEvolutionPointDto[];

  // Gastos por categoria (gráfico pizza)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryExpenseDto)
  expensesByCategory: CategoryExpenseDto[];

  // Transações recentes
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecentTransactionDto)
  recentTransactions: RecentTransactionDto[];
}