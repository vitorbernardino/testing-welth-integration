import { IsNumber, IsOptional } from 'class-validator';

export class UpdateDayDataDto {
  @IsOptional()
  @IsNumber()
  income?: number;

  @IsOptional()
  @IsNumber()
  expenses?: number;

  @IsOptional()
  @IsNumber()
  dailySpending?: number;

  @IsOptional()
  @IsNumber()
  balance?: number;
}