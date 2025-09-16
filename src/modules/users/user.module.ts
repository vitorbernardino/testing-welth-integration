import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './user.controller';
import { UsersService } from './user.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { ConnectionRepository } from '../pluggy/repositories/connection.repository';
import { PluggyModule } from '../pluggy/pluggy.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Transaction.name, schema: TransactionSchema }]),
    PluggyModule,
    forwardRef(() => TransactionsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}