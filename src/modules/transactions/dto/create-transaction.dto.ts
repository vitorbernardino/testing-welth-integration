import { IsEnum, IsNumber, IsDateString, IsString, IsOptional, IsBoolean, ValidateNested, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { Transaction as PluggyTransaction } from 'pluggy-sdk';

export class RecurringPatternDto {
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  frequency: string;

  @IsOptional()
  @IsNumber()
  dayOfMonth?: number;

  @IsOptional()
  @IsNumber()
  dayOfWeek?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CreateTransactionDto {
  // Campos obrigatórios do schema
  @IsString()
  type: string;

  @IsString()
  category: PluggyTransaction['category'];

  @IsNumber()
  amount: number;

  @IsDateString()
  date: Date;

  // Campos opcionais básicos
  @IsOptional()
  @IsString()
  description?: string;

  // Campos para transações recorrentes
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurringPatternDto)
  recurringPattern?: RecurringPatternDto;

  // Campos para integração com APIs externas (Pluggy)
  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  categoryId?:  PluggyTransaction['categoryId'];

  // Source da transação
  @IsOptional()
  @IsEnum(['manual', 'import', 'recurring', 'banking'])
  source?: string;

  // Referências
  @IsOptional()
  @IsMongoId()
  parentTransactionId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}