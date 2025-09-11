import { Module } from '@nestjs/common';
import { ConfigModule} from '@nestjs/config';
import { PluggyClient } from './clients/pluggy.client';
import { ConnectionService } from './services/connection.service';
import { WebhookController } from './controllers/webhook.controller';
import { TokenService } from './services/token.service';
import { ConnectionRepository } from './repositories/connection.repository';
import { UsersService } from '../users/user.service';
import { TransactionsService } from '../transactions/transactions.service';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [WebhookController],
  providers: [
    ConnectionRepository,
    TokenService,
    UsersService,
    ConnectionService,
    TransactionsService,
    PluggyClient,
  ],
})
export class PluggyModule {}
