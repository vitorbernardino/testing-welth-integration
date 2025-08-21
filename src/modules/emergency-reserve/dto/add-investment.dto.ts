import { IsEnum, IsString, IsNumber, Min } from 'class-validator';
import { InvestmentType } from '../schemas/emergency-reserve.schema';

export class AddInvestmentDto {
  @IsEnum(InvestmentType)
  type: InvestmentType;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNumber()
  @Min(0)
  annualRate: number;
}