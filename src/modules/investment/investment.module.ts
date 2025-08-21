import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InvestmentService } from './investment.service';
import { InvestmentController } from './investment.controller';

@Module({
  imports: [HttpModule],
  controllers: [InvestmentController],
  providers: [InvestmentService],
  exports: [InvestmentService],
})
export class InvestmentModule {}