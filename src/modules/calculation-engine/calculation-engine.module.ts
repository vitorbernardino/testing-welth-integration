import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalculationEngineService } from './calculation-engine.service';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { SpreadsheetData, SpreadsheetDataSchema } from '../spreadsheet/schemas/spreadsheet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: SpreadsheetData.name, schema: SpreadsheetDataSchema },
    ]),
  ],
  providers: [CalculationEngineService],
  exports: [CalculationEngineService],
})
export class CalculationEngineModule {}