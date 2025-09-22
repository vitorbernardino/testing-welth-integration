import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { CurrentUser } from '../../../common/decorators/auth.decorator';
import { User } from '../../users/schemas/user.schema';
import { ConnectionRepository } from '../repositories/connection.repository';
import { Connection } from '../schemas/connection.schema';

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionController {
  constructor(
    private readonly connectionRepository: ConnectionRepository,
  ) {}

  @Get()
  async getAllConnections(@CurrentUser() user: User): Promise<ApiResponse<Connection[]>> {
    const userConnections = await this.connectionRepository.findByUserId(user._id.toString());
    
    return {
      success: true,
      data: userConnections,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getConnectionById(
    @CurrentUser() user: User,
    @Param('id') connectionId: string,
  ): Promise<ApiResponse<Connection>> {
    const connection = await this.connectionRepository.findById(connectionId);
    
    if (!connection) {
      return {
        success: false,
        error: 'Connection not found',
        timestamp: new Date().toISOString(),
      };
    }

    if (connection.userId !== user._id.toString()) {
      return {
        success: false,
        error: 'Access denied to this connection',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: connection,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteConnection(
    @CurrentUser() user: User,
    @Param('id') connectionId: string,
  ): Promise<ApiResponse<boolean>> {
    const connection = await this.connectionRepository.findById(connectionId);
    
    if (!connection) {
      return {
        success: false,
        error: 'Connection not found',
        timestamp: new Date().toISOString(),
      };
    }

    if (connection.userId !== user._id.toString()) {
      return {
        success: false,
        error: 'Access denied to delete this connection',
        timestamp: new Date().toISOString(),
      };
    }

    const deletionResult = await this.connectionRepository.deleteById(connectionId);
    
    return {
      success: true,
      data: deletionResult,
      message: 'Connection deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}