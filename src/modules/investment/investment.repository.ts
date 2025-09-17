import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Investment, InvestmentDocument } from './schemas/investment.schema';

@Injectable()
export class InvestmentRepository {
  constructor(
    @InjectModel(Investment.name)
    private investmentModel: Model<InvestmentDocument>,
  ) {}

  /**
   * Cria um novo investimento
   */
  async create(investment: Partial<Investment>): Promise<Investment> {
    return this.investmentModel.create(investment);
  }

  /**
   * Busca um investimento por filtros
   */
  async findOne(where: FilterQuery<InvestmentDocument>): Promise<Investment | null> {
    return this.investmentModel.findOne(where).exec();
  }

  /**
   * Busca investimentos por filtros
   */
  async findAll(where: FilterQuery<InvestmentDocument>): Promise<Investment[]> {
    return this.investmentModel.find(where).sort({ createdAt: -1 }).exec();
  }

  /**
   * Busca investimentos por usuário
   */
  async findByUserId(userId: string): Promise<Investment[]> {
    return this.investmentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ balance: -1 })
      .exec();
  }

  /**
   * Busca investimentos por itemId
   */
  async findByItemId(itemId: string): Promise<Investment[]> {
    return this.investmentModel.find({ itemId }).exec();
  }

  /**
   * Atualiza um investimento
   */
  async updateOne(
    where: FilterQuery<InvestmentDocument>,
    update: Partial<Investment>
  ): Promise<Investment | null> {
    return this.investmentModel
      .findOneAndUpdate(where, update, { new: true })
      .exec();
  }

  /**
   * Remove investimentos por itemId (quando conexão é removida)
   */
  async deleteByItemId(itemId: string): Promise<void> {
    await this.investmentModel.deleteMany({ itemId }).exec();
  }

  /**
   * Faz upsert baseado no externalId
   */
  async upsertByExternalId(
    externalId: string,
    investmentData: Partial<Investment>
  ): Promise<Investment> {
    return this.investmentModel
      .findOneAndUpdate(
        { externalId },
        { ...investmentData, lastSyncAt: new Date() },
        { new: true, upsert: true }
      )
      .exec();
  }
}