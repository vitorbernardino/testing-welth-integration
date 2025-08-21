import { IsNumber, IsOptional, Min } from 'class-validator';

export class CreateEmergencyReserveDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyExpenses?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  targetMonths?: number = 6;

  @IsOptional()
  @IsNumber()
  @Min(0)
  suggestedMonthlyContribution?: number = 0;
}