import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpreadsheetService } from './spreadsheet.service';
import { SpreadsheetController } from './spreadsheet.controller';
import { SpreadsheetData, SpreadsheetDataSchema } from './schemas/spreadsheet.schema';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SpreadsheetData.name, schema: SpreadsheetDataSchema }]),
    TransactionsModule,
  ],
  controllers: [SpreadsheetController],
  providers: [SpreadsheetService],
  exports: [SpreadsheetService],
})
export class SpreadsheetModule {}