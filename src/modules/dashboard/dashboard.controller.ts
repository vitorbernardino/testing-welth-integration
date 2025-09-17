import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/auth.decorator';
import { User } from '../users/schemas/user.schema';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Endpoint principal do dashboard
   * Retorna todos os dados necessários para a tela de dashboard
   */
  @Get()
  async getDashboardData(
    @CurrentUser() user: User
  ): Promise<ApiResponse<DashboardResponseDto>> {
    const dashboardData = await this.dashboardService.getDashboardData(
      user._id.toString()
    );

    return {
      success: true,
      data: dashboardData,
      message: 'Dados do dashboard obtidos com sucesso',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Endpoint específico para métricas resumidas
   * Útil para widgets ou atualizações rápidas
   */
  @Get('summary')
  async getDashboardSummary(
    @CurrentUser() user: User
  ): Promise<ApiResponse<{
    currentBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    lastUpdated: string;
  }>> {
    const dashboardData = await this.dashboardService.getDashboardData(
      user._id.toString()
    );

    return {
      success: true,
      data: {
        currentBalance: dashboardData.currentBalance.currentValue,
        monthlyIncome: dashboardData.monthlyIncome.currentValue,
        monthlyExpenses: dashboardData.monthlyExpenses.currentValue,
        lastUpdated: new Date().toISOString()
      },
      message: 'Resumo do dashboard obtido com sucesso',
      timestamp: new Date().toISOString()
    };
  }
}