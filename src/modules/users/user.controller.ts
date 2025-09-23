import { Controller, Get, Put, Body, UseGuards, Post, Param, Query } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UsersService } from './user.service';
import { CurrentUser } from 'src/common/decorators/auth.decorator';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { TokenService } from '../pluggy/services/token.service';
import { ChangePasswordDto } from './dto/change-password.dto';


@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: User): Promise<ApiResponse<User>> {
    const userData = await this.usersService.findById(user._id);
    return {
      success: true,
      data: userData,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiResponse<User>> {
    const updatedUser = await this.usersService.update(user._id, updateUserDto);
    return {
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('/:id/token')
  async createToken(@Param('id') id: string, @Query('itemId') itemId?: string) {
    return this.tokenService.getTokenWithSdk(id, itemId);
  }

  @Get('/:id/connections')
  async getConnections(@Param('id') id: string) {
    return this.usersService.getConnections(id);
  }

  @Get('/:id/transactions')
  async getTransactions(@Param('id') id: string) {
    return this.usersService.getTransactions(id);
  }

  @Put('change-password')
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ApiResponse<User>> {
    const updatedUser = await this.usersService.changePassword(user._id, changePasswordDto);
    return {
      success: true,
      data: updatedUser,
      message: 'Password changed successfully',
      timestamp: new Date().toISOString(),
    };
}
}