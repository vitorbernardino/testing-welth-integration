import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class ReserveTransactionDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}