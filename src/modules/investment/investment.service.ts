import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PluggyClient } from '../pluggy/clients/pluggy.client';
import { Investment, InvestmentType, InvestmentSubtype } from './schemas/investment.schema';
import { Types } from 'mongoose';
import { InvestmentRepository } from './investment.repository';

interface InvestmentSyncEvent {
  itemId: string;
  userId: string;
}

interface PluggyInvestmentData {
  id: string;
  name: string;
  type: string;
  subtype?: string | null;
  balance: number;
  currency?: string;
  rate?: number | null;
  maturityDate?: string | null;
  issuer?: string | null;
  code?: string | null;
  lastUpdatedAt?: string;
  [key: string]: any;
}

@Injectable()
export class InvestmentsService {
  constructor(
    private investmentRepository: InvestmentRepository,
    private pluggyClient: PluggyClient,
  ) {}

  @OnEvent('investments.sync')
  async onInvestmentsSync(payload: InvestmentSyncEvent): Promise<void> {
    try {
      await this.syncInvestmentsFromPluggy(payload.itemId, payload.userId);
    } catch (error) {
      console.error(`❌ Erro na sincronização de investimentos para itemId: ${payload.itemId}:`, error);
    }
  }

  private async syncInvestmentsFromPluggy(itemId: string, userId: string): Promise<void> {
    const pluggyInvestments = await this.fetchInvestmentsFromPluggy(itemId);
    
    for (const pluggyInvestment of pluggyInvestments) {
      await this.upsertInvestment(pluggyInvestment, itemId, userId);
    }
  }

  private async fetchInvestmentsFromPluggy(itemId: string): Promise<PluggyInvestmentData[]> {
    try {
      const response = await this.pluggyClient
        .instance()
        .fetchInvestments(itemId);

      const investments = response?.results || response || [];
      
      return investments.map((investment: any): PluggyInvestmentData => ({
        id: investment.id || investment._id,
        name: investment.name || 'Investimento sem nome',
        type: investment.type || 'other',
        subtype: investment.subtype || null,
        balance: Number(investment.balance) || 0,
        currency: investment.currency || investment.currencyCode,
        rate: investment.rate ? Number(investment.rate) : null,
        maturityDate: investment.maturityDate || null,
        issuer: investment.issuer || null,
        code: investment.code || null,
        lastUpdatedAt: investment.lastUpdatedAt || investment.updatedAt,
      }));
      
    } catch (error) {
      console.error(`❌ Erro ao buscar investimentos da Pluggy para itemId: ${itemId}:`, error);
      
      if (error.message?.includes('fetchInvestments is not a function')) {
        return [];
      }
      
      return [];
    }
  }

  private async upsertInvestment(
    pluggyInvestment: PluggyInvestmentData,
    itemId: string,
    userId: string
  ): Promise<void> {
    const investmentData: Partial<Investment> = {
      userId: new Types.ObjectId(userId),
      externalId: pluggyInvestment.id,
      itemId,
      code: pluggyInvestment.code || this.generateCodeFromName(pluggyInvestment.name),
      name: pluggyInvestment.name,
      balance: pluggyInvestment.balance,
      currencyCode: pluggyInvestment.currency || 'BRL',
      type: this.mapInvestmentType(pluggyInvestment.type),
      subtype: this.mapInvestmentSubtype(pluggyInvestment.subtype || pluggyInvestment.type),
      rate: pluggyInvestment.rate || undefined,
      maturityDate: pluggyInvestment.maturityDate ? new Date(pluggyInvestment.maturityDate) : undefined,
      issuer: pluggyInvestment.issuer || undefined,
      source: 'pluggy',
    };

    await this.investmentRepository.upsertByExternalId(
      pluggyInvestment.id,
      investmentData
    );
  }

  private generateCodeFromName(name: string): string {
    return name
      .substring(0, 10)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .padEnd(3, 'X');
  }

  private mapInvestmentType(pluggyType: string): InvestmentType {
    if (!pluggyType) return InvestmentType.OTHER;
    
    const typeMap: Record<string, InvestmentType> = {
      'fixed_income': InvestmentType.FIXED_INCOME,
      'renda_fixa': InvestmentType.FIXED_INCOME,
      'variable_income': InvestmentType.VARIABLE_INCOME,
      'renda_variavel': InvestmentType.VARIABLE_INCOME,
      'fund': InvestmentType.FUND,
      'fundo': InvestmentType.FUND,
      'treasury': InvestmentType.TREASURY,
      'tesouro': InvestmentType.TREASURY,
      'cdb': InvestmentType.CDB,
      'lci': InvestmentType.LCI,
      'lca': InvestmentType.LCA,
    };

    return typeMap[pluggyType.toLowerCase()] || InvestmentType.OTHER;
  }

  private mapInvestmentSubtype(pluggySubtype: string | null): InvestmentSubtype {
    if (!pluggySubtype) return InvestmentSubtype.OTHER;
    
    const subtypeMap: Record<string, InvestmentSubtype> = {
      'cdb': InvestmentSubtype.CDB,
      'cdi_post_fixed': InvestmentSubtype.CDI_POST_FIXED,
      'pos_fixado_cdi': InvestmentSubtype.CDI_POST_FIXED,
      'savings': InvestmentSubtype.SAVINGS,
      'poupanca': InvestmentSubtype.SAVINGS,
      'treasury_selic': InvestmentSubtype.TREASURY_SELIC,
      'tesouro_selic': InvestmentSubtype.TREASURY_SELIC,
      'treasury_ipca': InvestmentSubtype.TREASURY_IPCA,
      'tesouro_ipca': InvestmentSubtype.TREASURY_IPCA,
      'treasury_pre_fixed': InvestmentSubtype.TREASURY_PRE_FIXED,
      'tesouro_pre_fixado': InvestmentSubtype.TREASURY_PRE_FIXED,
    };

    return subtypeMap[pluggySubtype.toLowerCase()] || InvestmentSubtype.OTHER;
  }

  async getInvestmentsByUserId(userId: string): Promise<Investment[]> {
    return this.investmentRepository.findByUserId(userId);
  }

  async getInvestmentsByItemId(itemId: string): Promise<Investment[]> {
    return this.investmentRepository.findByItemId(itemId);
  }

  async getTotalInvestedByUserId(userId: string): Promise<number> {
    const investments = await this.getInvestmentsByUserId(userId);
    return investments.reduce((total, investment) => total + investment.balance, 0);
  }

  async getInvestmentsSummaryByUserId(userId: string): Promise<any> {
    const investments = await this.getInvestmentsByUserId(userId);
    
    const totalInvested = investments.reduce((sum, inv) => sum + inv.balance, 0);
    
    const byType = investments.reduce((acc, investment) => {
      if (!acc[investment.type]) {
        acc[investment.type] = {
          type: investment.type,
          total: 0,
          count: 0,
          investments: [],
        };
      }
      
      acc[investment.type].total += investment.balance;
      acc[investment.type].count += 1;
      acc[investment.type].investments.push(investment);
      
      return acc;
    }, {} as any);

    return {
      totalInvested,
      totalProducts: investments.length,
      byType: Object.values(byType),
      investments,
    };
  }

  async syncInvestmentsByItemId(itemId: string, userId: string): Promise<any> {
    try {
      const pluggyInvestments = await this.fetchInvestmentsFromPluggy(itemId);
      
      if (pluggyInvestments.length === 0) {
        return {
          message: 'Nenhum investimento encontrado para esta conexão',
          totalInvestments: 0,
          investmentsProcessed: 0,
          investmentsSaved: 0,
          investmentsUpdated: 0,
        };
      }
  
      let investmentsSaved = 0;
      let investmentsUpdated = 0;
  
      for (const pluggyInvestment of pluggyInvestments) {
        const existingInvestment = await this.investmentRepository.findOne({
          externalId: pluggyInvestment.id,
        });
  
        await this.upsertInvestment(pluggyInvestment, itemId, userId);
  
        if (existingInvestment) {
          investmentsUpdated++;
        } else {
          investmentsSaved++;
        }
      }
  
      return {
        message: 'Sincronização de investimentos concluída com sucesso',
        totalInvestments: pluggyInvestments.length,
        investmentsProcessed: pluggyInvestments.length,
        data: pluggyInvestments,
        investmentsSaved,
        investmentsUpdated,
      };
  
    } catch (error) {
      console.error(`❌ Erro na sincronização manual de investimentos para itemId: ${itemId}:`, error);
      throw new Error(`Falha na sincronização de investimentos: ${error.message}`);
    }
  }
}