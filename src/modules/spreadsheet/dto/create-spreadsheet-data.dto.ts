import { IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDailyDataDto {
  @IsNumber()
  day: number;

  @IsOptional()
  @IsNumber()
  income?: number = 0;

  @IsOptional()
  @IsNumber()
  expenses?: number = 0;

  @IsOptional()
  @IsNumber()
  dailySpending?: number = 0;

  @IsOptional()
  @IsNumber()
  balance?: number = 0;

  @IsOptional()
  @IsNumber()
  calculatedBalance?: number = 0;
}

export class CreateMonthlyProjectionsDto {
  @IsOptional()
  @IsNumber()
  totalIncome?: number = 0;

  @IsOptional()
  @IsNumber()
  totalExpenses?: number = 0;

  @IsOptional()
  @IsNumber()
  netBalance?: number = 0;

  @IsOptional()
  @IsNumber()
  projectedBalance?: number = 0;
}

export class CreateSpreadsheetDataDto {
  @IsNumber()
  year: number;

  @IsNumber()
  month: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDailyDataDto)
  dailyData?: CreateDailyDataDto[] = [];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMonthlyProjectionsDto)
  monthlyProjections?: CreateMonthlyProjectionsDto;
}