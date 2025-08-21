import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmergencyReserveService } from './emergency-reserve.service';
import { CreateEmergencyReserveDto } from './dto/create-emergency-reserve.dto';
import { UpdateEmergencyReserveDto } from './dto/update-emergency-reserve.dto';
import { AddInvestmentDto } from './dto/add-investment.dto';
import { ReserveTransactionDto } from './dto/reserve-transaction.dto';
import { User } from '../users/schemas/user.schema';
import { EmergencyReserve } from './schemas/emergency-reserve.schema';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/auth.decorator';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';

@Controller('emergency-reserve')
@UseGuards(JwtAuthGuard)
export class EmergencyReserveController {
  constructor(private readonly emergencyReserveService: EmergencyReserveService) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() createEmergencyReserveDto: CreateEmergencyReserveDto,
  ): Promise<ApiResponse<EmergencyReserve>> {
    const reserve = await this.emergencyReserveService.create(
      user._id.toString(),
      createEmergencyReserveDto,
    );
    return {
      success: true,
      data: reserve,
      message: 'Emergency reserve created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async getReserve(@CurrentUser() user: User): Promise<ApiResponse<EmergencyReserve>> {
    const reserve = await this.emergencyReserveService.findByUser(user._id.toString());
    return {
      success: true,
      data: reserve,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  async getStats(@CurrentUser() user: User): Promise<ApiResponse<any>> {
    const stats = await this.emergencyReserveService.getReserveStats(user._id.toString());
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('projections')
  async getProjections(
    @CurrentUser() user: User,
    @Query('months') months: number = 12,
  ): Promise<ApiResponse<any>> {
    const projections = await this.emergencyReserveService.getProjections(
      user._id.toString(),
      months,
    );
    return {
      success: true,
      data: projections,
      timestamp: new Date().toISOString(),
    };
  }

  @Put()
  async update(
    @CurrentUser() user: User,
    @Body() updateEmergencyReserveDto: UpdateEmergencyReserveDto,
  ): Promise<ApiResponse<EmergencyReserve>> {
    const reserve = await this.emergencyReserveService.update(
      user._id.toString(),
      updateEmergencyReserveDto,
    );
    return {
      success: true,
      data: reserve,
      message: 'Emergency reserve updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('add-money')
  async addMoney(
    @CurrentUser() user: User,
    @Body() transactionDto: ReserveTransactionDto,
  ): Promise<ApiResponse<EmergencyReserve>> {
    const reserve = await this.emergencyReserveService.addMoney(
      user._id.toString(),
      transactionDto,
    );
    return {
      success: true,
      data: reserve,
      message: 'Money added to emergency reserve successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('remove-money')
  async removeMoney(
    @CurrentUser() user: User,
    @Body() transactionDto: ReserveTransactionDto,
  ): Promise<ApiResponse<EmergencyReserve>> {
    const reserve = await this.emergencyReserveService.removeMoney(
      user._id.toString(),
      transactionDto,
    );
    return {
      success: true,
      data: reserve,
      message: 'Money removed from emergency reserve successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('investments')
  async addInvestment(
    @CurrentUser() user: User,
    @Body() addInvestmentDto: AddInvestmentDto,
  ): Promise<ApiResponse<EmergencyReserve>> {
    const reserve = await this.emergencyReserveService.addInvestment(
      user._id.toString(),
      addInvestmentDto,
    );
    return {
      success: true,
      data: reserve,
      message: 'Investment added successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('investments/:index')
  async removeInvestment(
    @CurrentUser() user: User,
    @Param('index') index: number,
  ): Promise<ApiResponse<EmergencyReserve>> {
    const reserve = await this.emergencyReserveService.removeInvestment(
      user._id.toString(),
      index,
    );
    return {
      success: true,
      data: reserve,
      message: 'Investment removed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}