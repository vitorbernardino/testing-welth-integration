import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Investment, InvestmentSchema } from './schemas/investment.schema';
import { PluggyModule } from '../pluggy/pluggy.module';
import { InvestmentsController } from './investment.controller';
import { InvestmentsService } from './investment.service';
import { InvestmentRepository } from './investment.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Investment.name, schema: InvestmentSchema }]),
    PluggyModule,
  ],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentRepository],
  exports: [InvestmentsService, InvestmentRepository],
})
export class InvestmentsModule {}