import * as moment from 'moment-timezone';

// Constante para o fuso horário padrão do Brasil
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

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

/**
 * Normaliza uma data para o início do dia considerando o fuso horário brasileiro
 * Esta função garante que uma transação seja salva no dia correto independente do horário
 * 
 * @param date - Data a ser normalizada (pode ser string, Date ou moment)
 * @returns Date normalizada para o início do dia no fuso horário brasileiro
 * 
 * @example
 * // Transação às 23:41 do dia 06/09 em horário brasileiro
 * normalizeDateToBrazilianTimezone('2025-09-06T23:41:00-03:00') 
 * // Retorna: 2025-09-06T00:00:00-03:00 (início do dia 06/09 em BRT)
 * 
 * // Transação às 02:41 UTC do dia 07/09 (que é 23:41 BRT do dia 06/09)
 * normalizeDateToBrazilianTimezone('2025-09-07T02:41:00Z')
 * // Retorna: 2025-09-06T00:00:00-03:00 (início do dia 06/09 em BRT)
 */
export function normalizeDateToBrazilianTimezone(date: string | Date | moment.Moment): Date {
  // Converte a data para o fuso horário brasileiro mantendo o momento exato
  const brazilianMoment = moment.tz(date, BRAZIL_TIMEZONE);
  
  // Normaliza para o início do dia no fuso horário brasileiro
  const normalizedBrazilianMoment = brazilianMoment.startOf('day');
  
  // Retorna como Date object (será automaticamente convertido para UTC pelo MongoDB)
  return normalizedBrazilianMoment.toDate();
}

/**
 * Converte uma data para o fuso horário brasileiro sem alterar o dia
 * Útil para logs e debugging
 * 
 * @param date - Data a ser convertida
 * @returns String formatada no fuso horário brasileiro
 */
export function formatDateInBrazilianTimezone(date: string | Date | moment.Moment): string {
  return moment.tz(date, BRAZIL_TIMEZONE).format('YYYY-MM-DD HH:mm:ss [BRT]');
}

/**
 * Verifica se duas datas representam o mesmo dia no fuso horário brasileiro
 * 
 * @param date1 - Primeira data
 * @param date2 - Segunda data
 * @returns true se as datas são do mesmo dia no fuso horário brasileiro
 */
export function isSameDayInBrazilianTimezone(
  date1: string | Date | moment.Moment, 
  date2: string | Date | moment.Moment
): boolean {
  const moment1 = moment.tz(date1, BRAZIL_TIMEZONE);
  const moment2 = moment.tz(date2, BRAZIL_TIMEZONE);
  
  return moment1.format('YYYY-MM-DD') === moment2.format('YYYY-MM-DD');
}