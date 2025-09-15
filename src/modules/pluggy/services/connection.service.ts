import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { WebhookPayloadItem } from '../types/webhook.body';
import { PluggyClient } from '../clients/pluggy.client';
import { ConnectionRepository } from '../repositories/connection.repository';
import { isCreditCardAccount, isMainDebitAccount } from '../../../common/constants/account-types.constants';

@Injectable()
export class ConnectionService {
    constructor(
        private pluggyClient: PluggyClient,
        private connectionRepository: ConnectionRepository,
        private eventEmitter: EventEmitter2,
      ) {}

      @OnEvent('item/login_succeeded')
      async onItemInitiated(payload: WebhookPayloadItem) {
        const item = await this.pluggyClient.instance().fetchItem(payload.itemId);
    
        await this.connectionRepository.create({
          itemId: payload.itemId,
          name: item.connector.name,
          status: item.status,
          userId: item.clientUserId || '',
        });
      }

    @OnEvent('item/created')
    async onItemReady(payload: WebhookPayloadItem) {
      try {
        const item = await this.pluggyClient.instance().fetchItem(payload.itemId);
        
        if (!item.clientUserId) {
          console.error(`❌ clientUserId não encontrado para itemId: ${payload.itemId}`);
          return;
        }

          const existingConnection = await this.connectionRepository.findOne({
            itemId: payload.itemId,
          });

          if (!existingConnection) {
            await this.connectionRepository.create({
              itemId: payload.itemId,
              name: item.connector.name,
              status: item.status,
              userId: item.clientUserId,
            });
            console.log(`✅ Conexão criada para itemId: ${payload.itemId}`);
          } else {
            console.log(`ℹ️ Conexão já existe para itemId: ${payload.itemId} emitindo atualizacao das transacoes.`);
            this.eventEmitter.emit('connection.ready', {
              itemId: payload.itemId,
              userId: item.clientUserId,
            });
            return;
          }

        const { results: accounts } = await this.pluggyClient
          .instance()
          .fetchAccounts(payload.itemId);

        console.log(`📊 Encontradas ${accounts.length} contas para itemId: ${payload.itemId}`);

        // Filtrar contas para excluir cartões de crédito e evitar duplicação de dados
        const filteredAccounts = accounts.filter(account => {
          const isCreditCard = isCreditCardAccount(account);
          if (isCreditCard) {
            console.log(`🚫 Conta de cartão de crédito filtrada: ${account.name} (${account.id})`);
            return false;
          }
          return true;
        });

        console.log(`✅ ${filteredAccounts.length} contas válidas após filtro (excluídos cartões de crédito)`);

        // Priorizar conta corrente principal se existir
        const mainDebitAccount = filteredAccounts.find(account => isMainDebitAccount(account));
        const accountsToProcess = mainDebitAccount ? [mainDebitAccount] : filteredAccounts;

        if (mainDebitAccount) {
          console.log(`🎯 Processando apenas conta corrente principal: ${mainDebitAccount.name}`);
        } else {
          console.log(`📋 Processando todas as contas válidas (${accountsToProcess.length} contas)`);
        }

        // Emitir evento para sincronizar transações apenas das contas filtradas
        for (const account of accountsToProcess) {
          this.eventEmitter.emit('account.ready', {
            itemId: payload.itemId,
            accountId: account.id,
            userId: item.clientUserId,
            accountName: account.name,
          });
        }

      } catch (error) {
        console.error(`❌ Erro ao processar item/created para itemId: ${payload.itemId}:`, error);
      }
    }
  }
