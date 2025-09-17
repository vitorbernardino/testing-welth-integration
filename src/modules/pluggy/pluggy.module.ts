import { Module } from '@nestjs/common';
import { ConfigModule} from '@nestjs/config';
import { PluggyClient } from './clients/pluggy.client';
import { ConnectionService } from './services/connection.service';
import { WebhookController } from './controllers/webhook.controller';
import { TokenService } from './services/token.service';
import { ConnectionRepository } from './repositories/connection.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection, ConnectionSchema } from './schemas/connection.schema';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forFeature([{ name: Connection.name, schema: ConnectionSchema }]),
    MongooseModule.forFeature([{ name: Transaction.name, schema: TransactionSchema }]),
  ],
  controllers: [WebhookController],
  providers: [
    ConnectionRepository,
    TokenService,
    ConnectionService,
    PluggyClient,
  ],
  exports: [
    ConnectionRepository,
    TokenService,
    PluggyClient,
  ],
})
export class PluggyModule {}
