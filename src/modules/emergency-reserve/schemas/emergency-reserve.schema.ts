import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmergencyReserveDocument = EmergencyReserve & Document;

export enum InvestmentType {
  SAVINGS = 'savings',
  CDB = 'cdb',
  TESOURO_SELIC = 'tesouro_selic',
  LCI_LCA = 'lci_lca',
  FUND_DI = 'fund_di',
  OTHER = 'other',
}

@Schema({ _id: false })
export class Investment {
  @Prop({ required: true, enum: InvestmentType })
  type: InvestmentType;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  annualRate: number; // Taxa anual em %

  @Prop({ default: Date.now })
  investedAt: Date;
}

export const InvestmentSchema = SchemaFactory.createForClass(Investment);

@Schema({ _id: false })
export class ReserveTransaction {
  @Prop({ required: true, enum: ['deposit', 'withdrawal'] })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  description?: string;

  @Prop({ default: Date.now })
  date: Date;
}

export const ReserveTransactionSchema = SchemaFactory.createForClass(ReserveTransaction);

@Schema({ timestamps: true })
export class EmergencyReserve {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', unique: true })
  userId: Types.ObjectId;

  @Prop({ default: 0 })
  currentAmount: number;

  @Prop({ default: 0 })
  targetAmount: number;

  @Prop({ default: 0 })
  monthlyExpenses: number;

  @Prop({ default: 6 })
  targetMonths: number;

  @Prop({ default: 0 })
  suggestedMonthlyContribution: number;

  @Prop({ type: [InvestmentSchema], default: [] })
  investments: Investment[];

  @Prop({ type: [ReserveTransactionSchema], default: [] })
  transactions: ReserveTransaction[];

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const EmergencyReserveSchema = SchemaFactory.createForClass(EmergencyReserve);

// Create index for efficient user queries
EmergencyReserveSchema.index({ userId: 1 });