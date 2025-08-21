import { IsNumber, Min } from 'class-validator';

export class CalculateProjectionDto {
  @IsNumber()
  @Min(0)
  initialAmount: number;

  @IsNumber()
  @Min(0)
  monthlyContribution: number;

  @IsNumber()
  @Min(0)
  annualRate: number;

  @IsNumber()
  @Min(1)
  months: number;
}