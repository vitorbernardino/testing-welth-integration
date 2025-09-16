import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum IncomeCategory {
  SALARY = 'salary',
  FREELANCE = 'freelance',
  SALES = 'sales',
  INVESTMENTS = 'investments',
  OTHER = 'other',
}

export enum ExpenseCategory {
  FOOD = 'food',
  TRANSPORT = 'transport',
  BILLS = 'bills',
  LEISURE = 'leisure',
  HEALTH = 'health',
  EDUCATION = 'education',
  SHOPPING = 'shopping',
  OTHER = 'other',
}

@Schema({ _id: false })
export class RecurringPattern {
  @Prop({ required: true, enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  frequency: string;

  @Prop()
  dayOfMonth?: number;

  @Prop()
  dayOfWeek?: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  endDate?: Date;
}

export const RecurringPatternSchema = SchemaFactory.createForClass(RecurringPattern);

@Schema({ timestamps: true })
export class Transaction {
  _id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ unique: true, sparse: true })
  externalId?: string;

  @Prop()
  itemId?: string;

  @Prop()
  status?: string;

  @Prop({ required: true })
  type: string;

  @Prop()
  categoryId?: string;

  @Prop({ required: false, default: 'other' })
  category: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  currencyCode?: string;

  @Prop({ required: true })
  date: Date;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isRecurring: boolean;

  @Prop({ type: RecurringPatternSchema })
  recurringPattern?: RecurringPattern;

  @Prop({ default: 'manual' })
  source: string;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  parentTransactionId?: Types.ObjectId;

  @Prop()
  accountId?: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);