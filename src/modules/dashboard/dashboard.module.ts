import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TransactionsModule } from '../transactions/transactions.module';
import { SpreadsheetModule } from '../spreadsheet/spreadsheet.module';
import { EmergencyReserveModule } from '../emergency-reserve/emergency-reserve.module';

@Module({
  imports: [TransactionsModule, SpreadsheetModule, EmergencyReserveModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}