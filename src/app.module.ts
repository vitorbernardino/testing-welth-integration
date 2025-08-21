import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { FileImportModule } from './modules/file-import/file-import.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalculationEngineModule } from './modules/calculation-engine/calculation-engine.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmergencyReserveModule } from './modules/emergency-reserve/emergency-reserve.module';
import { InvestmentModule } from './modules/investment/investment.module';
import { SpreadsheetModule } from './modules/spreadsheet/spreadsheet.module';
import { UsersModule } from './modules/users/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-management'),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    TransactionsModule,
    SpreadsheetModule,
    EmergencyReserveModule,
    FileImportModule,
    InvestmentModule,
    CalculationEngineModule,
    DashboardModule,
  ],
})
export class AppModule {}