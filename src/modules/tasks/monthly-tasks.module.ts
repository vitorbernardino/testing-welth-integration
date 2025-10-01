import { Module } from '@nestjs/common';
import { MonthlyTasksService } from './monthly-tasks.service';
import { UsersModule } from '../users/user.module';
import { SpreadsheetModule } from '../spreadsheet/spreadsheet.module';


@Module({
  imports: [
    UsersModule,
    SpreadsheetModule,
  ],
//   controllers: [
//     TasksController,
//   ],
  providers: [
    MonthlyTasksService,
  ],
})
export class TasksModule {}