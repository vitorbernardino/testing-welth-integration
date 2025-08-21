import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileImportService } from './file-import.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import { User } from '../users/schemas/user.schema';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { ImportedStatement } from './schemas/imported-statement.schema';

@Controller('file-import')
@UseGuards(JwtAuthGuard)
export class FileImportController {
  constructor(private readonly fileImportService: FileImportService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.includes('csv') && !file.mimetype.includes('pdf')) {
        return callback(new BadRequestException('Only CSV and PDF files are allowed'), false);
      }
      callback(null, true);
    },
  }))
  // async uploadFile(
  //   @CurrentUser() user: User,
  //   @UploadedFile() file: Express.Multer.File,
  // ): Promise<ApiResponse<ImportedStatement>> {
  //   if (!file) {
  //     throw new BadRequestException('No file provided');
  //   }

  //   const importResult = await this.fileImportService.importFile(
  //     user._id.toString(),
  //     file,
  //   );

  //   return {
  //     success: true,
  //     data: importResult,
  //     message: 'File imported successfully',
  //     timestamp: new Date().toISOString(),
  //   };
  // }

  @Get('history')
  async getImportHistory(@CurrentUser() user: User): Promise<ApiResponse<ImportedStatement[]>> {
    const history = await this.fileImportService.getImportHistory(user._id.toString());
    return {
      success: true,
      data: history,
      timestamp: new Date().toISOString(),
    };
  }
}