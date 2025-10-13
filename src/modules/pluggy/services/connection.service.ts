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
    
        await this.connectionRepository.upsertByUserIdAndConnectorName(
          item.clientUserId || '',
          item.connector.name,
          {
            itemId: payload.itemId,
            status: item.status,
          },
        );
      }

    @OnEvent('item/created')
    async onItemReady(payload: WebhookPayloadItem) {
      try {
        const item = await this.pluggyClient.instance().fetchItem(payload.itemId);
        
        if (!item.clientUserId) {
          console.error(`❌ clientUserId não encontrado para itemId: ${payload.itemId}`);
          return;
        }

        await this.connectionRepository.upsertByUserIdAndConnectorName(
          item.clientUserId,
          item.connector.name,
          {
            itemId: payload.itemId,
            status: item.status,
          },
        );
        
        const { results: accounts } = await this.pluggyClient
          .instance()
          .fetchAccounts(payload.itemId);

        const filteredAccounts = accounts.filter(account => {
          const isCreditCard = isCreditCardAccount(account);
          if (isCreditCard) {
            return false;
          }
          return true;
        });

        const mainDebitAccount = filteredAccounts.find(account => isMainDebitAccount(account));
        const accountsToProcess = mainDebitAccount ? [mainDebitAccount] : filteredAccounts;

        for (const account of accountsToProcess) {
          this.eventEmitter.emit('account.ready', {
            itemId: payload.itemId,
            accountId: account.id,
            userId: item.clientUserId,
            accountName: account.name,
          });
        }

        this.eventEmitter.emit('investments.sync', {
          itemId: payload.itemId,
          userId: item.clientUserId,
        });
      } catch (error) {
        console.error(`❌ Erro ao processar item/created para itemId: ${payload.itemId}:`, error);
      }
    }
  }