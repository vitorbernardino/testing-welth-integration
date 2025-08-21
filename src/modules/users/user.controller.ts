import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UsersService } from './user.service';
import { CurrentUser } from 'src/common/decorators/auth.decorator';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';


@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}