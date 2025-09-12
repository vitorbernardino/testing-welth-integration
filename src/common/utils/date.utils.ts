
export function getCurrentMonthDateRange(): {
    currentMonthStart: Date;
    currentMonthEnd: Date;
  } {
    const currentDate = new Date();
    
    // Primeiro dia do mês atual às 00:00:00
    const currentMonthStart = new Date(
      currentDate.getFullYear(), 
      currentDate.getMonth(), 
      1, 
      0, 0, 0, 0
    );
    
    // Último dia do mês atual às 23:59:59.999
    const currentMonthEnd = new Date(
      currentDate.getFullYear(), 
      currentDate.getMonth() + 1, 
      0, 
      23, 59, 59, 999
    );
    
    return { currentMonthStart, currentMonthEnd };
  }
  
  /**
   * Verifica se uma data está dentro do mês atual
   * @param date - Data a ser verificada
   * @returns true se a data está no mês atual, false caso contrário
   */
  export function isDateInCurrentMonth(date: Date | string): boolean {
    const { currentMonthStart, currentMonthEnd } = getCurrentMonthDateRange();
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    
    return targetDate >= currentMonthStart && targetDate <= currentMonthEnd;
  }