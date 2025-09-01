import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transaction, TransactionDocument, TransactionType } from './schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PaginatedResponse } from 'src/common/interfaces/api-response.interface';
import * as moment from 'moment';

const DEFAULT_RECENT_TRANSACTIONS_LIMIT = 5;
const DEFAULT_MONTHLY_AVERAGE_MONTHS = 6;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    console.log(`💰 Criando transação: ${createTransactionDto.type} - R$ ${createTransactionDto.amount} em ${createTransactionDto.date}`);
    
    const normalizedDate = moment.utc(createTransactionDto.date).startOf('day').toDate();

    const transaction = new this.transactionModel({
      ...createTransactionDto,
      userId: new Types.ObjectId(userId),
      date: normalizedDate, // Usa data normalizada
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
    console.log(`📝 Atualizando transação ${id}`);
    
    // Busca a transação antes da atualização para capturar data anterior
    const existingTransaction = await this.findById(id, userId);
    const previousDate = existingTransaction.date;
    const previousAmount = existingTransaction.amount;
    const previousType = existingTransaction.type;

    let normalizedDate = existingTransaction.date;
    if (updateTransactionDto.date) {
      normalizedDate = moment.utc(updateTransactionDto.date).startOf('day').toDate();
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
      console.log(`✅ Transação ${id} deletada`);
      
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

    // Verifica se já existe uma transação para este dia
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
      console.log(`⏭️ Transação recorrente já existe para ${moment(date).format('YYYY-MM-DD')}`);
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
    const normalizedDate = moment.utc(date).startOf('day').toDate();
    
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
          type: TransactionType.EXPENSE,
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
    const transactionDate = moment(date);
    const startDate = transactionDate.clone().startOf('day').toDate();
    const endDate = transactionDate.clone().endOf('day').toDate();

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
}