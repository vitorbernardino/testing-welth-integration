import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvestmentDocument = Investment & Document;

export enum InvestmentType {
  FIXED_INCOME = 'fixed_income',
  VARIABLE_INCOME = 'variable_income',
  FUND = 'fund',
  TREASURY = 'treasury',
  CDB = 'cdb',
  LCI = 'lci',
  LCA = 'lca',
  OTHER = 'other'
}

export enum InvestmentSubtype {
  CDB = 'cdb',
  CDI_POST_FIXED = 'cdi_post_fixed',
  SAVINGS = 'savings',
  TREASURY_SELIC = 'treasury_selic',
  TREASURY_IPCA = 'treasury_ipca',
  TREASURY_PRE_FIXED = 'treasury_pre_fixed',
  OTHER = 'other'
}

@Schema({ timestamps: true })
export class Investment {
  _id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  externalId: string;

  @Prop({ required: true })
  itemId: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, type: Number })
  balance: number;

  @Prop({ required: true, default: 'BRL' })
  currencyCode: string;

  @Prop({ required: true, enum: InvestmentType })
  type: InvestmentType;

  @Prop({ required: true, enum: InvestmentSubtype })
  subtype: InvestmentSubtype;

  @Prop({ type: Number })
  rate?: number;

  @Prop({ type: Date })
  maturityDate?: Date;

  @Prop()
  issuer?: string;

  @Prop({ type: Number })
  percentageOfPortfolio?: number;

  @Prop({ default: 'pluggy' })
  source: string;

  @Prop({ type: Date })
  lastSyncAt?: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const InvestmentSchema = SchemaFactory.createForClass(Investment);

InvestmentSchema.index({ userId: 1, itemId: 1 });
InvestmentSchema.index({ externalId: 1 });
InvestmentSchema.index({ type: 1, subtype: 1 });