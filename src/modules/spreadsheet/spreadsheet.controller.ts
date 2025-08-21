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
import { SpreadsheetService } from './spreadsheet.service';
import { CreateSpreadsheetDataDto } from './dto/create-spreadsheet-data.dto';
import { UpdateSpreadsheetDataDto } from './dto/update-spreadsheet-data.dto';
import { UpdateDayDataDto } from './dto/update-day-data.dto';
import { User } from '../users/schemas/user.schema';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/auth.decorator';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { SpreadsheetData } from './schemas/spreadsheet.schema';

@Controller('spreadsheet')
@UseGuards(JwtAuthGuard)
export class SpreadsheetController {
  constructor(private readonly spreadsheetService: SpreadsheetService) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() createSpreadsheetDataDto: CreateSpreadsheetDataDto,
  ): Promise<ApiResponse<SpreadsheetData>> {
    const spreadsheetData = await this.spreadsheetService.create(
      user._id.toString(),
      createSpreadsheetDataDto,
    );
    return {
      success: true,
      data: spreadsheetData,
      message: 'Spreadsheet data created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('initialize')
  async initializeSpreadsheets(@CurrentUser() user: User): Promise<ApiResponse<SpreadsheetData[]>> {
    const spreadsheets = await this.spreadsheetService.initializeUserSpreadsheets(user._id.toString());
    return {
      success: true,
      data: spreadsheets,
      message: 'User spreadsheets initialized successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('add-month')
  async addNextMonth(@CurrentUser() user: User): Promise<ApiResponse<SpreadsheetData>> {
    const newMonth = await this.spreadsheetService.addNextMonth(user._id.toString());
    return {
      success: true,
      data: newMonth,
      message: 'New month added successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('all')
  async getAllSpreadsheets(@CurrentUser() user: User): Promise<ApiResponse<SpreadsheetData[]>> {
    const data = await this.spreadsheetService.getAllUserSpreadsheets(user._id.toString());
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('next-10-months')
  async getNext10Months(@CurrentUser() user: User): Promise<ApiResponse<SpreadsheetData[]>> {
    const data = await this.spreadsheetService.getNext10Months(user._id.toString());
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('year/:year')
  async getYearlyOverview(
    @CurrentUser() user: User,
    @Param('year') year: number,
  ): Promise<ApiResponse<any>> {
    const overview = await this.spreadsheetService.getYearlyOverview(
      user._id.toString(),
      year,
    );
    return {
      success: true,
      data: overview,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':year/:month')
  async findByMonth(
    @CurrentUser() user: User,
    @Param('year') year: number,
    @Param('month') month: number,
  ): Promise<ApiResponse<SpreadsheetData>> {
    const data = await this.spreadsheetService.findByUserAndMonth(
      user._id.toString(),
      year,
      month,
    );
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':year/:month')
  async update(
    @CurrentUser() user: User,
    @Param('year') year: number,
    @Param('month') month: number,
    @Body() updateSpreadsheetDataDto: UpdateSpreadsheetDataDto,
  ): Promise<ApiResponse<SpreadsheetData>> {
    const data = await this.spreadsheetService.update(
      user._id.toString(),
      year,
      month,
      updateSpreadsheetDataDto,
    );
    return {
      success: true,
      data,
      message: 'Spreadsheet data updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':year/:month/day/:day')
  async updateDayData(
    @CurrentUser() user: User,
    @Param('year') year: number,
    @Param('month') month: number,
    @Param('day') day: number,
    @Body() updateDayDataDto: UpdateDayDataDto,
  ): Promise<ApiResponse<SpreadsheetData>> {
    const data = await this.spreadsheetService.updateDayData(
      user._id.toString(),
      year,
      month,
      day,
      updateDayDataDto,
    );
    return {
      success: true,
      data,
      message: 'Day data updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':year/:month')
  async delete(
    @CurrentUser() user: User,
    @Param('year') year: number,
    @Param('month') month: number,
  ): Promise<ApiResponse<boolean>> {
    const result = await this.spreadsheetService.delete(
      user._id.toString(),
      year,
      month,
    );
    return {
      success: true,
      data: result,
      message: 'Spreadsheet data deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}