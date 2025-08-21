import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ImportedStatementDocument = ImportedStatement & Document;

@Schema({ timestamps: true })
export class ImportedStatement {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true, enum: ['csv', 'pdf'] })
  fileType: string;

  @Prop({ required: true, enum: ['processing', 'completed', 'failed'] })
  status: string;

  @Prop([{ type: Types.ObjectId, ref: 'Transaction' }])
  processedTransactions: Types.ObjectId[];

  @Prop()
  rawData: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ImportedStatementSchema = SchemaFactory.createForClass(ImportedStatement);