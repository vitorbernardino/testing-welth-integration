import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface InvestmentRate {
  id: string;
  name: string;
  type: 'fixed' | 'variable';
  annualRate: number;
  description: string;
  minimumAmount?: number;
  liquidity: 'daily' | 'monthly' | 'maturity';
  risk: 'low' | 'medium' | 'high';
  lastUpdated: Date;
}

@Injectable()
export class InvestmentService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('INVESTMENT_API_URL') || 
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
  }

  async getSelicRate(): Promise<number> {
    try {
      // Taxa Selic - Série 432 do BCB
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}.432/dados/ultimos/1?formato=json`)
      );

      if (response.data && response.data.length > 0) {
        return parseFloat(response.data[0].valor);
      }

      throw new Error('No Selic rate data available');
    } catch (error) {
      console.error('Error fetching Selic rate:', error);
      // Fallback to a default rate if API fails
      return 13.75; // Default Selic rate
    }
  }

  async getCDIRate(): Promise<number> {
    try {
      // Taxa CDI - Série 12 do BCB
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}.12/dados/ultimos/1?formato=json`)
      );

      if (response.data && response.data.length > 0) {
        return parseFloat(response.data[0].valor);
      }

      throw new Error('No CDI rate data available');
    } catch (error) {
      console.error('Error fetching CDI rate:', error);
      // Fallback based on Selic rate
      const selicRate = await this.getSelicRate();
      return selicRate * 0.95; // CDI is typically ~95% of Selic
    }
  }

  async getIPCARate(): Promise<number> {
    try {
      // IPCA - Série 433 do BCB (acumulado 12 meses)
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}.433/dados/ultimos/1?formato=json`)
      );

      if (response.data && response.data.length > 0) {
        return parseFloat(response.data[0].valor);
      }

      throw new Error('No IPCA rate data available');
    } catch (error) {
      console.error('Error fetching IPCA rate:', error);
      // Fallback to inflation target
      return 4.5; // Default IPCA rate (inflation target)
    }
  }

  async getAvailableInvestments(): Promise<InvestmentRate[]> {
    try {
      const [selicRate, cdiRate, ipcaRate] = await Promise.all([
        this.getSelicRate(),
        this.getCDIRate(),
        this.getIPCARate(),
      ]);

      const investments: InvestmentRate[] = [
        {
          id: 'savings',
          name: 'Poupança',
          type: 'variable',
          annualRate: this.calculateSavingsRate(selicRate),
          description: 'Caderneta de poupança tradicional',
          minimumAmount: 0,
          liquidity: 'daily',
          risk: 'low',
          lastUpdated: new Date(),
        },
        {
          id: 'cdb_100_cdi',
          name: 'CDB 100% CDI',
          type: 'variable',
          annualRate: cdiRate,
          description: 'Certificado de Depósito Bancário que rende 100% do CDI',
          minimumAmount: 1000,
          liquidity: 'maturity',
          risk: 'low',
          lastUpdated: new Date(),
        },
        {
          id: 'cdb_110_cdi',
          name: 'CDB 110% CDI',
          type: 'variable',
          annualRate: cdiRate * 1.1,
          description: 'Certificado de Depósito Bancário que rende 110% do CDI',
          minimumAmount: 5000,
          liquidity: 'maturity',
          risk: 'low',
          lastUpdated: new Date(),
        },
        {
          id: 'cdb_120_cdi',
          name: 'CDB 120% CDI',
          type: 'variable',
          annualRate: cdiRate * 1.2,
          description: 'Certificado de Depósito Bancário que rende 120% do CDI',
          minimumAmount: 10000,
          liquidity: 'maturity',
          risk: 'low',
          lastUpdated: new Date(),
        },
        {
          id: 'tesouro_selic',
          name: 'Tesouro Selic',
          type: 'variable',
          annualRate: selicRate * 0.97, // Desconta taxa de custódia
          description: 'Título público indexado à taxa Selic',
          minimumAmount: 100,
          liquidity: 'daily',
          risk: 'low',
          lastUpdated: new Date(),
        },
        {
          id: 'tesouro_ipca',
          name: 'Tesouro IPCA+',
          type: 'fixed',
          annualRate: ipcaRate + 6, // IPCA + juro real estimado
          description: 'Título público indexado ao IPCA',
          minimumAmount: 100,
          liquidity: 'daily',
          risk: 'medium',
          lastUpdated: new Date(),
        },
        {
          id: 'lci_95_cdi',
          name: 'LCI 95% CDI',
          type: 'variable',
          annualRate: cdiRate * 0.95,
          description: 'Letra de Crédito Imobiliário (isenta de IR)',
          minimumAmount: 5000,
          liquidity: 'maturity',
          risk: 'low',
          lastUpdated: new Date(),
        },
        {
          id: 'lca_95_cdi',
          name: 'LCA 95% CDI',
          type: 'variable',
          annualRate: cdiRate * 0.95,
          description: 'Letra de Crédito do Agronegócio (isenta de IR)',
          minimumAmount: 5000,
          liquidity: 'maturity',
          risk: 'low',
          lastUpdated: new Date(),
        },
        {
          id: 'fund_di',
          name: 'Fundo DI',
          type: 'variable',
          annualRate: cdiRate * 0.85, // Desconta taxa de administração
          description: 'Fundo de investimento em renda fixa DI',
          minimumAmount: 100,
          liquidity: 'daily',
          risk: 'low',
          lastUpdated: new Date(),
        },
      ];

      return investments;
    } catch (error) {
      console.error('Error fetching investment rates:', error);
      throw new HttpException(
        'Unable to fetch current investment rates',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async getInvestmentById(id: string): Promise<InvestmentRate | null> {
    const investments = await this.getAvailableInvestments();
    return investments.find(inv => inv.id === id) || null;
  }

  calculateProjectedValue(
    initialAmount: number,
    monthlyContribution: number,
    annualRate: number,
    months: number,
  ): any {
    const monthlyRate = annualRate / 100 / 12;
    let currentValue = initialAmount;
    const projections: { month: number; value: number; totalContributed: number; interestEarned: number }[] = [];

    for (let month = 0; month <= months; month++) {
      if (month > 0) {
        // Apply interest to current value
        currentValue = currentValue * (1 + monthlyRate);
        // Add monthly contribution
        currentValue += monthlyContribution;
      }

      projections.push({
        month,
        value: Math.round(currentValue * 100) / 100,
        totalContributed: initialAmount + (monthlyContribution * month),
        interestEarned: Math.round((currentValue - initialAmount - (monthlyContribution * month)) * 100) / 100,
      });
    }

    const totalContributed = initialAmount + (monthlyContribution * months);
    const totalInterest = currentValue - totalContributed;

    return {
      projections,
      summary: {
        initialAmount,
        monthlyContribution,
        annualRate,
        months,
        finalValue: Math.round(currentValue * 100) / 100,
        totalContributed,
        totalInterest: Math.round(totalInterest * 100) / 100,
        returnPercentage: Math.round((totalInterest / totalContributed) * 100 * 100) / 100,
      },
    };
  }

  async compareInvestments(
    amount: number,
    monthlyContribution: number = 0,
    months: number = 12,
  ): Promise<any> {
    const investments = await this.getAvailableInvestments();
    
    const comparisons = investments.map(investment => {
      const projection = this.calculateProjectedValue(
        amount,
        monthlyContribution,
        investment.annualRate,
        months,
      );

      return {
        investment,
        finalValue: projection.summary.finalValue,
        totalInterest: projection.summary.totalInterest,
        returnPercentage: projection.summary.returnPercentage,
      };
    });

    // Sort by final value (descending)
    comparisons.sort((a, b) => b.finalValue - a.finalValue);

    return {
      comparisons,
      parameters: {
        amount,
        monthlyContribution,
        months,
      },
      bestOption: comparisons[0],
      conservativeOptions: comparisons.filter(c => c.investment.risk === 'low'),
    };
  }

  private calculateSavingsRate(selicRate: number): number {
    // Regra da poupança:
    // Se Selic > 8.5%: TR + 0.5% ao mês (~6.17% ao ano)
    // Se Selic <= 8.5%: 70% da Selic
    if (selicRate > 8.5) {
      return 6.17; // TR + 0.5% ao mês
    } else {
      return selicRate * 0.7;
    }
  }

  async getMarketData(): Promise<any> {
    try {
      const [selicRate, cdiRate, ipcaRate] = await Promise.all([
        this.getSelicRate(),
        this.getCDIRate(),
        this.getIPCARate(),
      ]);

      return {
        selic: {
          rate: selicRate,
          description: 'Taxa básica de juros da economia brasileira',
          lastUpdated: new Date(),
        },
        cdi: {
          rate: cdiRate,
          description: 'Certificado de Depósito Interbancário',
          lastUpdated: new Date(),
        },
        ipca: {
          rate: ipcaRate,
          description: 'Índice Nacional de Preços ao Consumidor Amplo',
          lastUpdated: new Date(),
        },
        savings: {
          rate: this.calculateSavingsRate(selicRate),
          description: 'Taxa de rendimento da poupança',
          lastUpdated: new Date(),
        },
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw new HttpException(
        'Unable to fetch market data',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}