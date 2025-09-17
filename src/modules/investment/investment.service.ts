import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PluggyClient } from '../pluggy/clients/pluggy.client';
import { Investment, InvestmentType, InvestmentSubtype } from './schemas/investment.schema';
import { Types } from 'mongoose';
import { InvestmentRepository } from './investment.repository';

/**
 * Interface para evento de sincronização de investimentos
 */
interface InvestmentSyncEvent {
  itemId: string;
  userId: string;
}

/**
 * Interface para dados de investimento retornados pela Pluggy SDK
 * Baseada na estrutura real da API Pluggy
 */
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
  // Outras propriedades que podem vir da Pluggy
  [key: string]: any;
}

@Injectable()
export class InvestmentsService {
  constructor(
    private investmentRepository: InvestmentRepository,
    private pluggyClient: PluggyClient,
  ) {}

  /**
   * Listener para sincronizar investimentos quando conexão é estabelecida
   */
  @OnEvent('investments.sync')
  async onInvestmentsSync(payload: InvestmentSyncEvent): Promise<void> {
    try {
      console.log(`💰 Iniciando sincronização de investimentos para itemId: ${payload.itemId}`);
      
      await this.syncInvestmentsFromPluggy(payload.itemId, payload.userId);
      
      console.log(`✅ Sincronização de investimentos concluída para itemId: ${payload.itemId}`);
    } catch (error) {
      console.error(`❌ Erro na sincronização de investimentos para itemId: ${payload.itemId}:`, error);
    }
  }

  /**
   * Sincroniza investimentos da Pluggy
   */
  private async syncInvestmentsFromPluggy(itemId: string, userId: string): Promise<void> {
    const pluggyInvestments = await this.fetchInvestmentsFromPluggy(itemId);
    
    for (const pluggyInvestment of pluggyInvestments) {
      await this.upsertInvestment(pluggyInvestment, itemId, userId);
    }
  }

  /**
   * Busca investimentos da API Pluggy
   * Corrigida a tipagem para corresponder ao retorno real da SDK
   */
  private async fetchInvestmentsFromPluggy(itemId: string): Promise<PluggyInvestmentData[]> {
    try {
      // A SDK da Pluggy retorna { results: Investment[] }
      const response = await this.pluggyClient
        .instance()
        .fetchInvestments(itemId);

      // Verificar se a resposta tem a estrutura esperada
      const investments = response?.results || response || [];
      
      console.log(`📊 Encontrados ${investments.length} investimentos na Pluggy para itemId: ${itemId}`);
      
      // Mapear os dados da Pluggy para nossa interface
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
      
      // Se o método fetchInvestments não existir, tentar alternativas
      if (error.message?.includes('fetchInvestments is not a function')) {
        console.log(`⚠️ Método fetchInvestments não disponível. Retornando array vazio.`);
        return [];
      }
      
      return [];
    }
  }

  /**
   * Cria ou atualiza investimento no banco
   */
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

  /**
   * Gera código a partir do nome quando não disponível
   */
  private generateCodeFromName(name: string): string {
    return name
      .substring(0, 10)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .padEnd(3, 'X');
  }

  /**
   * Mapeia tipo de investimento da Pluggy para enum interno
   */
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

  /**
   * Mapeia subtipo de investimento da Pluggy para enum interno
   */
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

  /**
   * Busca investimentos por usuário
   */
  async getInvestmentsByUserId(userId: string): Promise<Investment[]> {
    return this.investmentRepository.findByUserId(userId);
  }

  /**
   * Busca investimentos por itemId
   */
  async getInvestmentsByItemId(itemId: string): Promise<Investment[]> {
    return this.investmentRepository.findByItemId(itemId);
  }

  /**
   * Calcula total investido por usuário
   */
  async getTotalInvestedByUserId(userId: string): Promise<number> {
    const investments = await this.getInvestmentsByUserId(userId);
    return investments.reduce((total, investment) => total + investment.balance, 0);
  }

  /**
   * Agrupa investimentos por tipo
   */
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
}