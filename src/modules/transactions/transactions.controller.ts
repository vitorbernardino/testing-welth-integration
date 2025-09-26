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
import { TransactionsService } from './transactions.service';
import { User } from '../users/schemas/user.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction } from './schemas/transaction.schema';
import { FilterTransactionsDto } from './dto/filter-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ApiResponse, PaginatedResponse } from 'src/common/interfaces/api-response.interface';
import { CurrentUser } from 'src/common/decorators/auth.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<ApiResponse<Transaction>> {
    const transaction = await this.transactionsService.create(
      user._id.toString(),
      createTransactionDto,
    );
    return {
      success: true,
      data: transaction,
      message: 'Transaction created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  
  @Get('categories')
  async getAllCategories(): Promise<ApiResponse<string[]>> {
    const categories = await this.transactionsService.getAllCategories();
    return {
      success: true,
      data: categories,
      message: 'Categories retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query() filterDto: FilterTransactionsDto,
  ): Promise<PaginatedResponse<Transaction>> {
    return this.transactionsService.findAll(user._id.toString(), filterDto);
  }

  @Get('recent')
  async getRecent(@CurrentUser() user: User): Promise<ApiResponse<Transaction[]>> {
    const transactions = await this.transactionsService.getRecentTransactions(
      user._id.toString(),
      5,
    );
    return {
      success: true,
      data: transactions,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats/:year/:month')
  async getMonthlyStats(
    @CurrentUser() user: User,
    @Param('year') year: number,
    @Param('month') month: number,
  ): Promise<ApiResponse<any>> {
    const stats = await this.transactionsService.getMonthlyStats(
      user._id.toString(),
      year,
      month,
    );
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<ApiResponse<Transaction>> {
    const transaction = await this.transactionsService.findById(
      id,
      user._id.toString(),
    );
    return {
      success: true,
      data: transaction,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ): Promise<ApiResponse<Transaction>> {
    const transaction = await this.transactionsService.update(
      id,
      user._id.toString(),
      updateTransactionDto,
    );
    return {
      success: true,
      data: transaction,
      message: 'Transaction updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<ApiResponse<boolean>> {
    const result = await this.transactionsService.delete(id, user._id.toString());
    return {
      success: true,
      data: result,
      message: 'Transaction deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sync/:itemId')
  async syncConnection(
    @CurrentUser() user: User,
    @Param('itemId') itemId: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.transactionsService.syncConnectionTransactions(
      user._id.toString(),
      itemId,
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sync-all')
  async syncAllConnections(
    @CurrentUser() user: User,
  ): Promise<ApiResponse<any>> {
    const result = await this.transactionsService.syncAllUserConnections(
      user._id.toString(),
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}