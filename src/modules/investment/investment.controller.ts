import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import { User } from '../users/schemas/user.schema';
import { InvestmentsService } from './investment.service';

@Controller('investments')
@UseGuards(JwtAuthGuard)
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  /**
   * Busca todos os investimentos do usuário logado
   */
  @Get()
  async getUserInvestments(@CurrentUser() user: User): Promise<ApiResponse<any>> {
    const summary = await this.investmentsService.getInvestmentsSummaryByUserId(user._id);
    
    return {
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Busca investimentos por itemId (conexão específica)
   */
  @Get('by-connection/:itemId')
  async getInvestmentsByConnection(@Param('itemId') itemId: string): Promise<ApiResponse<any[]>> {
    const investments = await this.investmentsService.getInvestmentsByItemId(itemId);
    
    return {
      success: true,
      data: investments,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Busca total investido pelo usuário
   */
  @Get('total')
  async getTotalInvested(@CurrentUser() user: User): Promise<ApiResponse<number>> {
    const total = await this.investmentsService.getTotalInvestedByUserId(user._id);
    
    return {
      success: true,
      data: total,
      timestamp: new Date().toISOString(),
    };
  }
}