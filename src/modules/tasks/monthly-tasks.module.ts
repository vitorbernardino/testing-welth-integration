import { Module } from '@nestjs/common';
import { MonthlyTasksService } from './monthly-tasks.service';
import { UsersModule } from '../users/user.module';
import { SpreadsheetModule } from '../spreadsheet/spreadsheet.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { InvestmentsModule } from '../investment/investment.module';
import { PluggyModule } from '../pluggy/pluggy.module';


@Module({
  imports: [
    UsersModule,
    SpreadsheetModule,
    TransactionsModule,
    InvestmentsModule,
    PluggyModule,
  ],
  providers: [
    MonthlyTasksService,
  ],
})
export class TasksModule {}