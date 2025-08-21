import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmergencyReserveService } from './emergency-reserve.service';
import { EmergencyReserveController } from './emergency-reserve.controller';
import { EmergencyReserve, EmergencyReserveSchema } from './schemas/emergency-reserve.schema';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: EmergencyReserve.name, schema: EmergencyReserveSchema }]),
    TransactionsModule,
  ],
  controllers: [EmergencyReserveController],
  providers: [EmergencyReserveService],
  exports: [EmergencyReserveService],
})
export class EmergencyReserveModule {}