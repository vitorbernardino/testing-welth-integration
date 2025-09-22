import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SpreadsheetService } from '../spreadsheet/spreadsheet.service';
import { UsersService } from '../users/user.service';
import { TransactionsService } from '../transactions/transactions.service';
import { InvestmentsService } from '../investment/investment.service';
import { ConnectionRepository } from '../pluggy/repositories/connection.repository';
import { Connection } from '../pluggy/schemas/connection.schema';

@Injectable()
export class MonthlyTasksService {
  private readonly logger = new Logger(MonthlyTasksService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly spreadsheetService: SpreadsheetService,
    private readonly transactionsService: TransactionsService,
    private readonly investmentsService: InvestmentsService,
    private readonly connectionRepository: ConnectionRepository,
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
  
  @Cron('0 6 * * *', {
    name: 'daily-pluggy-sync',
    timeZone: 'America/Sao_Paulo',
  })
  async handleDailyPluggySync() {
    this.logger.log('Iniciando sincronização diária da Pluggy para todos os usuários...');

    try {
      const allConnections = await this.connectionRepository.findAll({});
      
      if (!allConnections || allConnections.length === 0) {
        this.logger.log('Nenhuma conexão Pluggy encontrada para sincronizar.');
        return;
      }

      const connectionsByUser = this.groupConnectionsByUserId(allConnections);
      
      let totalUsersProcessed = 0;
      let totalTransactionsSynced = 0;
      let totalInvestmentsSynced = 0;

      await Promise.allSettled(
        Object.entries(connectionsByUser).map(async ([userId, userConnections]) => {
          try {
            this.logger.log(`Processando ${userConnections.length} conexões do usuário: ${userId}`);
            
            // Força a tipagem correta do array de conexões
            const syncResults = await this.syncUserConnections(userId, userConnections as Connection[]);
            
            totalUsersProcessed++;
            totalTransactionsSynced += syncResults.transactionsSynced;
            totalInvestmentsSynced += syncResults.investmentsSynced;

          } catch (error) {
            this.logger.error(`Erro ao processar usuário ${userId}:`, error.message);
          }
        })
      );

      this.logger.log(
        `Sincronização diária concluída. ` +
        `Usuários processados: ${totalUsersProcessed}, ` +
        `Transações sincronizadas: ${totalTransactionsSynced}, ` +
        `Investimentos sincronizados: ${totalInvestmentsSynced}`
      );

    } catch (error) {
      this.logger.error('Erro na sincronização diária da Pluggy:', error.message);
    }
  }

  private groupConnectionsByUserId(connections: Connection[]): Record<string, Connection[]> {
    return connections.reduce((grouped, connection) => {
      const userId = connection.userId.toString();
      if (!grouped[userId]) {
        grouped[userId] = [];
      }
      grouped[userId].push(connection);
      return grouped;
    }, {} as Record<string, Connection[]>);
  }

  private async syncUserConnections(userId: string, connections: Connection[]) {
    let transactionsSynced = 0;
    let investmentsSynced = 0;

    for (const connection of connections) {
      try {
        const transactionResult = await this.transactionsService.syncConnectionTransactions(
          userId, 
          connection.itemId
        );
        transactionsSynced += transactionResult.totalTransactions || 0;

        const investmentResult = await this.investmentsService.syncInvestmentsByItemId(
          connection.itemId, 
          userId
        );
        investmentsSynced += investmentResult.investmentsProcessed || 0;

        this.logger.debug(
          `Conexão ${connection.itemId} sincronizada: ` +
          `${transactionResult.totalTransactions || 0} transações, ` +
          `${investmentResult.investmentsProcessed || 0} investimentos`
        );

      } catch (error) {
        this.logger.warn(
          `Erro ao sincronizar conexão ${connection.itemId} do usuário ${userId}: ${error.message}`
        );
      }
    }

    return { transactionsSynced, investmentsSynced };
  }

}