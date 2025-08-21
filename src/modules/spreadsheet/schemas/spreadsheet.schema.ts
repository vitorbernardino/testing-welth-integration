import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SpreadsheetDataDocument = SpreadsheetData & Document;

@Schema({ _id: false })
export class DailyData {
  @Prop({ required: true })
  day: number;

  @Prop({ default: 0 })
  income: number;

  @Prop({ default: 0 })
  expenses: number;

  @Prop({ default: 0 })
  dailySpending: number;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ default: 0 })
  calculatedBalance: number;
}

export const DailyDataSchema = SchemaFactory.createForClass(DailyData);

@Schema({ _id: false })
export class MonthlyProjections {
  @Prop({ default: 0 })
  totalIncome: number;

  @Prop({ default: 0 })
  totalExpenses: number;

  @Prop({ default: 0 })
  netBalance: number;

  @Prop({ default: 0 })
  projectedBalance: number;
}

export const MonthlyProjectionsSchema = SchemaFactory.createForClass(MonthlyProjections);

@Schema({ timestamps: true })
export class SpreadsheetData {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  year: number;

  @Prop({ required: true })
  month: number;

  @Prop({ type: [DailyDataSchema], default: [] })
  dailyData: DailyData[];

  @Prop({ type: MonthlyProjectionsSchema })
  monthlyProjections: MonthlyProjections;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const SpreadsheetDataSchema = SchemaFactory.createForClass(SpreadsheetData);

// Create compound index for efficient queries
SpreadsheetDataSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });