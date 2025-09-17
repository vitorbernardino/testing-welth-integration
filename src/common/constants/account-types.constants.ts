export const PLUGGY_ACCOUNT_TYPES = {
    BANK: 'BANK',
    CREDIT: 'CREDIT',
    INVESTMENT: 'INVESTMENT'
  } as const;
  
  export const PLUGGY_ACCOUNT_SUBTYPES = {
    CHECKING: 'CHECKING',
    SAVINGS: 'SAVINGS',
    
    CREDIT_CARD: 'CREDIT_CARD',
    
    BROKERAGE: 'BROKERAGE' 
  } as const;
  
  export function isCreditCardAccount(account: any): boolean {
    return account.type === PLUGGY_ACCOUNT_TYPES.CREDIT && 
           account.subtype === PLUGGY_ACCOUNT_SUBTYPES.CREDIT_CARD;
  }
  
  export function isMainDebitAccount(account: any): boolean {
    return account.type === PLUGGY_ACCOUNT_TYPES.BANK && 
           account.subtype === PLUGGY_ACCOUNT_SUBTYPES.CHECKING;
  }