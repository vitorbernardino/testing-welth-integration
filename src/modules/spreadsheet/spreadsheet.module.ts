import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpreadsheetService } from './spreadsheet.service';
import { SpreadsheetController } from './spreadsheet.controller';
import { SpreadsheetData, SpreadsheetDataSchema } from './schemas/spreadsheet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SpreadsheetData.name, schema: SpreadsheetDataSchema }]),
  ],
  controllers: [SpreadsheetController],
  providers: [SpreadsheetService],
  exports: [SpreadsheetService],
})
export class SpreadsheetModule {}