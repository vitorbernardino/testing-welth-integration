import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { User } from '../users/schemas/user.schema';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/auth.decorator';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';


@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@CurrentUser() user: User): Promise<ApiResponse<any>> {
    const dashboardData = await this.dashboardService.getDashboardData(user._id.toString());
    return {
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
    };
  }
}