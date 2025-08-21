import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvestmentService } from './investment.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { CalculateProjectionDto } from './dto/calculate-projection.dto';
import { CompareInvestmentsDto } from './dto/compare-investments.dto';

@Controller('investments')
@UseGuards(JwtAuthGuard)
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  @Get('available')
  async getAvailableInvestments(): Promise<ApiResponse<any[]>> {
    const investments = await this.investmentService.getAvailableInvestments();
    return {
      success: true,
      data: investments,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('market-data')
  async getMarketData(): Promise<ApiResponse<any>> {
    const marketData = await this.investmentService.getMarketData();
    return {
      success: true,
      data: marketData,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('rates/selic')
  async getSelicRate(): Promise<ApiResponse<number>> {
    const rate = await this.investmentService.getSelicRate();
    return {
      success: true,
      data: rate,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('rates/cdi')
  async getCDIRate(): Promise<ApiResponse<number>> {
    const rate = await this.investmentService.getCDIRate();
    return {
      success: true,
      data: rate,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('rates/ipca')
  async getIPCARate(): Promise<ApiResponse<number>> {
    const rate = await this.investmentService.getIPCARate();
    return {
      success: true,
      data: rate,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getInvestmentById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const investment = await this.investmentService.getInvestmentById(id);
    return {
      success: true,
      data: investment,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('calculate-projection')
  async calculateProjection(@Body() calculateProjectionDto: CalculateProjectionDto): Promise<ApiResponse<any>> {
    const projection = this.investmentService.calculateProjectedValue(
      calculateProjectionDto.initialAmount,
      calculateProjectionDto.monthlyContribution,
      calculateProjectionDto.annualRate,
      calculateProjectionDto.months,
    );
    return {
      success: true,
      data: projection,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('compare')
  async compareInvestments(@Body() compareInvestmentsDto: CompareInvestmentsDto): Promise<ApiResponse<any>> {
    const comparison = await this.investmentService.compareInvestments(
      compareInvestmentsDto.amount,
      compareInvestmentsDto.monthlyContribution,
      compareInvestmentsDto.months,
    );
    return {
      success: true,
      data: comparison,
      timestamp: new Date().toISOString(),
    };
  }
}