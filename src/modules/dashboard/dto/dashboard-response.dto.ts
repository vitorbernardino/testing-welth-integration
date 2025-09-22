import { IsNumber, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

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

export class BalanceEvolutionPointDto {
  @IsString()
  date: string;

  @IsNumber()
  balance: number;

  @IsNumber()
  day: number;
}

export class CategoryExpenseDto {
  @IsString()
  category: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  percentage: number;
}

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
  formattedAmount: string;
}

export class DashboardResponseDto {
  @ValidateNested()
  @Type(() => MonthlyComparisonDto)
  currentBalance: MonthlyComparisonDto;

  @ValidateNested()
  @Type(() => MonthlyComparisonDto)
  monthlyIncome: MonthlyComparisonDto;

  @ValidateNested()
  @Type(() => MonthlyComparisonDto)
  monthlyExpenses: MonthlyComparisonDto;

  @IsNumber()
  averageMonthlyExpenses: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceEvolutionPointDto)
  balanceEvolution: BalanceEvolutionPointDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryExpenseDto)
  expensesByCategory: CategoryExpenseDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecentTransactionDto)
  recentTransactions: RecentTransactionDto[];
}