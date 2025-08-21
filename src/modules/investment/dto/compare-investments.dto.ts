import { IsNumber, IsOptional, Min } from 'class-validator';

export class CompareInvestmentsDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyContribution?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  months?: number = 12;
}