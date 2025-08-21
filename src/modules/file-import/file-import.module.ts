import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileImportService } from './file-import.service';
import { FileImportController } from './file-import.controller';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportedStatement, ImportedStatementSchema } from './schemas/imported-statement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ImportedStatement.name, schema: ImportedStatementSchema }]),
    TransactionsModule,
  ],
  controllers: [FileImportController],
  providers: [FileImportService],
  exports: [FileImportService],
})
export class FileImportModule {}