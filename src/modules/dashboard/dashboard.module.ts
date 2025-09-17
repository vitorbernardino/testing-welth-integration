import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

// Schemas necessários
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { Investment, InvestmentSchema } from '../investment/schemas/investment.schema';
import { SpreadsheetData, SpreadsheetDataSchema } from '../spreadsheet/schemas/spreadsheet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Investment.name, schema: InvestmentSchema },
      { name: SpreadsheetData.name, schema: SpreadsheetDataSchema }
    ])
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService]
})
export class DashboardModule {}