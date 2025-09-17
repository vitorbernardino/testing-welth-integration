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
  @IsString()
  type: string;

  @IsString()
  @IsOptional() 
  category: PluggyTransaction['category'];

  @IsNumber()
  amount: number;

  @IsDateString()
  date: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurringPatternDto)
  recurringPattern?: RecurringPatternDto;

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

  @IsOptional()
  @IsEnum(['manual', 'import', 'recurring', 'banking'])
  source?: string;

  @IsOptional()
  @IsMongoId()
  parentTransactionId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}