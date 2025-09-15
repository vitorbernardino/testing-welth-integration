/**
 * Constantes para tipos de conta da API Pluggy
 * Baseado na documentação oficial da Pluggy
 */
export const PLUGGY_ACCOUNT_TYPES = {
    // Tipos principais de conta
    BANK: 'BANK',           // Conta bancária (débito/poupança)
    CREDIT: 'CREDIT',       // Conta de crédito (cartão de crédito)
    INVESTMENT: 'INVESTMENT' // Conta de investimento
  } as const;
  
  export const PLUGGY_ACCOUNT_SUBTYPES = {
    // Subtipos para contas bancárias
    CHECKING: 'CHECKING',   // Conta corrente
    SAVINGS: 'SAVINGS',     // Conta poupança
    
    // Subtipos para cartões de crédito
    CREDIT_CARD: 'CREDIT_CARD', // Cartão de crédito
    
    // Subtipos para investimentos
    BROKERAGE: 'BROKERAGE'  // Conta de investimento/corretora
  } as const;
  
  /**
   * Função utilitária para verificar se uma conta é de cartão de crédito
   * @param account - Objeto da conta retornado pela Pluggy
   * @returns true se for cartão de crédito, false caso contrário
   */
  export function isCreditCardAccount(account: any): boolean {
    return account.type === PLUGGY_ACCOUNT_TYPES.CREDIT && 
           account.subtype === PLUGGY_ACCOUNT_SUBTYPES.CREDIT_CARD;
  }
  
  /**
   * Função utilitária para verificar se uma conta é de débito principal
   * @param account - Objeto da conta retornado pela Pluggy
   * @returns true se for conta corrente, false caso contrário
   */
  export function isMainDebitAccount(account: any): boolean {
    return account.type === PLUGGY_ACCOUNT_TYPES.BANK && 
           account.subtype === PLUGGY_ACCOUNT_SUBTYPES.CHECKING;
  }