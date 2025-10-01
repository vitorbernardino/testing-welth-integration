import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SpreadsheetService } from '../spreadsheet/spreadsheet.service';
import { UsersService } from '../users/user.service';

@Injectable()
export class MonthlyTasksService {
  private readonly logger = new Logger(MonthlyTasksService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly spreadsheetService: SpreadsheetService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyRollover() {
    this.logger.log('Iniciando tarefa de virada de mês para todos os usuários...');

    const allUsers = await this.usersService.findAll();
    if (!allUsers || allUsers.length === 0) {
      this.logger.log('Nenhum usuário encontrado para processar.');
      return;
    }

    await Promise.all(
      allUsers.map(async (user) => {
        const userId = user._id.toString();
        this.logger.log(`Processando usuário: ${userId}`);
        
        await this.spreadsheetService.updateHistoricalFlagForPastMonths(userId);

        await this.spreadsheetService.ensureProjectionHorizon(userId);
      }),
    );

    this.logger.log('Tarefa de virada de mês concluída com sucesso.');
  }
}