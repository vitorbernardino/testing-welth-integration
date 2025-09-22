import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PaginatedResponse } from 'src/common/interfaces/api-response.interface';
import * as moment from 'moment';
import { PluggyClient } from '../pluggy/clients/pluggy.client';
import { ConnectionRepository } from '../pluggy/repositories/connection.repository';
import { WebhookPayloadTransaction } from '../pluggy/types/webhook.body';
import { Transaction as PluggyTransaction } from 'pluggy-sdk';
import { getCurrentMonthDateRange, normalizeDateToBrazilianTimezone } from 'src/common/utils/date.utils';
import { isCreditCardAccount, isMainDebitAccount } from 'src/common/constants/account-types.constants';

const DEFAULT_RECENT_TRANSACTIONS_LIMIT = 5;
const DEFAULT_MONTHLY_AVERAGE_MONTHS = 6;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private pluggyClient: PluggyClient,
    private connectionRepository: ConnectionRepository,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('transactions/created')
  async onTransactionsCreated(payload: WebhookPayloadTransaction) {
    const connection = await this.connectionRepository.findOne({
      itemId: payload.itemId,
    });
  
    if (!connection) {
      console.error(`❌ Conexão não encontrada para itemId: ${payload.itemId}`);
      return;
    }
  
    const { currentMonthStart, currentMonthEnd } = getCurrentMonthDateRange();
  
    const { results: transactions } = await this.pluggyClient
      .instance()
      .fetchTransactions(payload.accountId, {
        createdAtFrom: payload.transactionsCreatedAtFrom,
      });
  
    const currentMonthTransactions = this.filterTransactionsByCurrentMonth(
      transactions, 
      currentMonthStart, 
      currentMonthEnd
    );
  
    if (currentMonthTransactions.length === 0) {
      return;
    }
  
    await this.saveTransactions(
      payload.itemId,
      connection.userId.toString(),
      currentMonthTransactions,
    );
  }

  @OnEvent('transactions/updated')
  async onTransactionsUpdated(payload: WebhookPayloadTransaction) {
    const connection = await this.connectionRepository.findOne({
      itemId: payload.itemId,
    });
  
    if (!connection) {
      console.error(`❌ Conexão não encontrada para itemId: ${payload.itemId}`);
      return;
    }
  
    const { currentMonthStart, currentMonthEnd } = getCurrentMonthDateRange();
  
    const { results: transactions } = await this.pluggyClient
      .instance()
      .fetchTransactions(payload.accountId, {
        ids: payload.transactionIds,
      });
  
    const currentMonthTransactions = this.filterTransactionsByCurrentMonth(
      transactions, 
      currentMonthStart, 
      currentMonthEnd
    );
  
    if (currentMonthTransactions.length === 0) {
      return;
    }
  
    await this.saveTransactions(
      payload.itemId,
      connection.userId.toString(),
      currentMonthTransactions,
    );
  }

  @OnEvent('transactions/deleted')
  async onTransactionDeleted(payload: WebhookPayloadTransaction) {
    await this.transactionModel.deleteMany({
      where: { externalId: payload.transactionIds },
    });
  }

  @OnEvent('account.ready')
  async onAccountReady(payload: { itemId: string; accountId: string; userId: string; accountName: string }) {
    try {
      const { currentMonthStart, currentMonthEnd } = getCurrentMonthDateRange();
      
      const { results: transactions } = await this.pluggyClient
        .instance()
        .fetchTransactions(payload.accountId, {
          createdAtFrom: currentMonthStart.toISOString(),
          to: currentMonthEnd.toISOString(),
        });

      const currentMonthTransactions = this.filterTransactionsByCurrentMonth(
        transactions, 
        currentMonthStart, 
        currentMonthEnd
      );

      if (currentMonthTransactions.length === 0) {
        return;
      }

      await this.saveTransactions(
        payload.itemId,
        payload.userId,
        currentMonthTransactions,
      );
    } catch (error) {
      console.error(`❌ Erro ao processar conta ${payload.accountName}:`, error);
    }
  }


  @OnEvent('connection.ready')
  async onConnectionReady(payload: { itemId: string; userId: string }) {
  try {
    const result = await this.syncConnectionTransactions(payload.userId, payload.itemId);
  } catch (error) {
    console.error(`❌ Erro ao sincronizar conexão ${payload.itemId}:`, error);
  }
}

  private async saveTransactions(
    itemId: string,
    userId: string,
    transactions: PluggyTransaction[],
  ) {
    const savedTransactions: Transaction[] = [];
  
    for (const transaction of transactions) {
      try {
        const createTransactionDto = {
          type: transaction.type,
          category: transaction.category || 'other',
          amount: transaction.amount,
          date: transaction.date,
          description: transaction.description,
          externalId: transaction.id,
          itemId,
          status: transaction.status,
          currencyCode: transaction.currencyCode,
          categoryId: transaction.categoryId,
          accountId: transaction.accountId,
          source: 'import',
        };
  
        const existingTransaction = await this.transactionModel.findOne({
          externalId: transaction.id,
        });
  
        if (existingTransaction) {
          const updatedTransaction = await this.update(
            existingTransaction._id.toString(),
            userId,
            {
              status: transaction.status,
              description: transaction.description,
              amount: transaction.amount,
              date: transaction.date,
              category: transaction.category || '',
              currencyCode: transaction.currencyCode,
            }
          );
          
          savedTransactions.push(updatedTransaction);
        } else {
          const savedTransaction = await this.create(userId, createTransactionDto);
          savedTransactions.push(savedTransaction);
        }
  
      } catch (error) {
        console.error(`❌ Erro ao salvar transação ${transaction.id}:`, error.message);
      }
    }
  
    return {
      saved: savedTransactions,
      total: transactions.length,
    };
  }

  async create(userId: string, createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    
    const originalDate = createTransactionDto.date;
    const normalizedDate = normalizeDateToBrazilianTimezone(originalDate);

    const transaction = new this.transactionModel({
      ...createTransactionDto,
      userId: new Types.ObjectId(userId),
      date: normalizedDate,
    });

    const savedTransaction = await transaction.save();

    this.eventEmitter.emit('transaction.created', {
      userId,
      transaction: savedTransaction,
    });

    return savedTransaction;
  }

  async findAll(
    userId: string,
    filterDto: FilterTransactionsDto,
  ): Promise<PaginatedResponse<Transaction>> {
    const { page = 1, limit = 10, type, category, dateFrom, dateTo, search } = filterDto;
    
    const filter: any = { userId: new Types.ObjectId(userId) };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    
    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filter),
    ]);

    return {
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async findById(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async update(
    id: string,
    userId: string,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    
    const existingTransaction = await this.findById(id, userId);
    const previousDate = existingTransaction.date;
    const previousAmount = existingTransaction.amount;
    const previousType = existingTransaction.type;

    let normalizedDate = existingTransaction.date;
    if (updateTransactionDto.date) {
      normalizedDate = normalizeDateToBrazilianTimezone(updateTransactionDto.date);
    }

    const transaction = await this.transactionModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      {
        ...updateTransactionDto,
        date: normalizedDate,
      },
      { new: true },
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    this.eventEmitter.emit('transaction.updated', {
      userId,
      transaction,
      previousDate,
      previousAmount,
      previousType,
    });

    return transaction;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existingTransaction = await this.findById(id, userId);
    
    const result = await this.transactionModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount > 0) {
      
      this.eventEmitter.emit('transaction.deleted', {
        userId,
        transactionId: id,
        date: existingTransaction.date,
        amount: existingTransaction.amount,
        type: existingTransaction.type,
      });
      return true;
    }

    return false;
  }

  async getRecentTransactions(userId: string, limit: number = DEFAULT_RECENT_TRANSACTIONS_LIMIT): Promise<Transaction[]> {
    return this.transactionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .limit(limit)
      .exec();
  }

  async getMonthlyStats(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          categories: {
            $push: {
              category: '$category',
              amount: '$amount',
            },
          },
        },
      },
    ]);

    return transactions;
  }

  async createRecurringTransactions(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recurringTransactions = await this.transactionModel.find({
      isRecurring: true,
      'recurringPattern.isActive': true,
    });

    for (const transaction of recurringTransactions) {
      if (await this.shouldCreateRecurringTransaction(transaction, today)) {
        await this.createRecurringTransaction(transaction, today);
      }
    }
  }

  private async shouldCreateRecurringTransaction(transaction: Transaction, date: Date): Promise<boolean> {
    const pattern = transaction.recurringPattern;
    if (!pattern) return false;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingTransaction = await this.transactionModel.findOne({
      parentTransactionId: transaction._id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (existingTransaction) {
      return false;
    }

    switch (pattern.frequency) {
      case 'monthly':
        return date.getDate() === pattern.dayOfMonth;
      case 'weekly':
        return date.getDay() === pattern.dayOfWeek;
      case 'daily':
        return true;
      default:
        return false;
    }
  }

  private async createRecurringTransaction(parentTransaction: Transaction, date: Date): Promise<void> {
    const normalizedDate = normalizeDateToBrazilianTimezone(date);
    
    const newTransaction = new this.transactionModel({
      userId: parentTransaction.userId,
      type: parentTransaction.type,
      category: parentTransaction.category,
      amount: parentTransaction.amount,
      date: normalizedDate,
      description: `${parentTransaction.description} (Recorrente)`,
      source: 'recurring',
      parentTransactionId: parentTransaction._id,
      isRecurring: false,
    });

    const savedTransaction = await newTransaction.save();

    this.eventEmitter.emit('transaction.created', {
      userId: parentTransaction.userId.toString(),
      transaction: savedTransaction,
    });
  }

  async calculateMonthlyExpenseAverage(userId: string, months: number = DEFAULT_MONTHLY_AVERAGE_MONTHS): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const transactions = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: 'expense',
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' },
        },
      },
    ]);

    if (transactions.length === 0) return 0;

    return Number((transactions[0].totalExpenses / months).toFixed(2));
  }

  async findDuplicate(
    userId: string,
    date: string,
    amount: number,
    description: string
  ): Promise<Transaction | null> {
    const normalizedSearchDate = normalizeDateToBrazilianTimezone(date);
    const startDate = moment(normalizedSearchDate).startOf('day').toDate();
    const endDate = moment(normalizedSearchDate).endOf('day').toDate();

    return this.transactionModel.findOne({
      userId: new Types.ObjectId(userId),
      amount,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      description: { $regex: description.substring(0, 20), $options: 'i' },
    });
  }

  async syncConnectionTransactions(userId: string, itemId: string) {    
    const connection = await this.connectionRepository.findOne({ itemId });
    if (!connection) {
      throw new NotFoundException(`Conexão não encontrada para itemId: ${itemId}`);
    }

    if (connection.userId.toString() !== userId) {
      throw new NotFoundException('Conexão não pertence ao usuário');
    }

    try {
        const { currentMonthStart, currentMonthEnd } = getCurrentMonthDateRange();
  
        const { results: accounts } = await this.pluggyClient
          .instance()
          .fetchAccounts(itemId);

        const filteredAccounts = accounts.filter(account => {
          const isCreditCard = isCreditCardAccount(account);
          if (isCreditCard) {
            return false;
          }
          return true;
        });

        const mainDebitAccount = filteredAccounts.find(account => isMainDebitAccount(account));
        const accountsToProcess = mainDebitAccount ? [mainDebitAccount] : filteredAccounts;
  
        let totalTransactions = 0;
        const results: { accountId: string; accountName: string; transactionsFound: number; transactionsSaved: number }[] = [];
  
        for (const account of accountsToProcess) {
          const { results: transactions } = await this.pluggyClient
            .instance()
            .fetchTransactions(account.id, {
              createdAtFrom: currentMonthStart.toISOString(),
              to: currentMonthEnd.toISOString(),
            });
  
          const currentMonthTransactions = this.filterTransactionsByCurrentMonth(
            transactions, 
            currentMonthStart, 
            currentMonthEnd
          );

          const savedResult = await this.saveTransactions(
            itemId,
            userId,
            currentMonthTransactions,
          );
  
          results.push({
            accountId: account.id,
            accountName: account.name,
            transactionsFound: currentMonthTransactions.length,
            transactionsSaved: savedResult.saved.length,
          });
  
          totalTransactions += currentMonthTransactions.length;
        }
          
        return {
          message: 'Sincronização concluída com sucesso',
          totalTransactions,
          accountsProcessed: results.length,
          details: results
        };

      } catch (error) {
        console.error(`❌ Erro na sincronização manual:`, error);
        throw error;
      }
  }

  async syncAllUserConnections(userId: string) {    
    const connections = await this.connectionRepository.findAll({ userId });
    
    if (connections.length === 0) {
      return {
        success: true,
        message: 'Nenhuma conexão encontrada para sincronizar',
        results: [],
      };
    }

    const results: { success: boolean; itemId: string; error: string }[] = [];
    let totalTransactions = 0;

    for (const connection of connections) {
      try {
        const result = await this.syncConnectionTransactions(userId, connection.itemId);
        results.push({
          success: true,
          itemId: connection.itemId,
          error: '',
        });
        totalTransactions += result.totalTransactions;
      } catch (error) {
        console.error(`❌ Erro na sincronização da conexão ${connection.itemId}:`, error);
        results.push({
          success: false,
          itemId: connection.itemId,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      totalConnections: connections.length,
      totalTransactions,
      results,
      message: `Sincronização concluída. ${totalTransactions} transações processadas de ${connections.length} conexões.`,
    };
  }

  private filterTransactionsByCurrentMonth(
    transactions: PluggyTransaction[], 
    monthStart: Date, 
    monthEnd: Date
  ): PluggyTransaction[] {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= monthStart && transactionDate <= monthEnd;
    });
  }
}