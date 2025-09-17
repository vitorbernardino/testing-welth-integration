import * as moment from 'moment-timezone';

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

export function getCurrentMonthDateRange(): {
    currentMonthStart: Date;
    currentMonthEnd: Date;
  } {
    const currentDate = new Date();
    
    const currentMonthStart = new Date(
      currentDate.getFullYear(), 
      currentDate.getMonth(), 
      1, 
      0, 0, 0, 0
    );
    
    const currentMonthEnd = new Date(
      currentDate.getFullYear(), 
      currentDate.getMonth() + 1, 
      0, 
      23, 59, 59, 999
    );
    
    return { currentMonthStart, currentMonthEnd };
  }
  
  export function isDateInCurrentMonth(date: Date | string): boolean {
    const { currentMonthStart, currentMonthEnd } = getCurrentMonthDateRange();
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    
    return targetDate >= currentMonthStart && targetDate <= currentMonthEnd;
  }

export function normalizeDateToBrazilianTimezone(date: string | Date | moment.Moment): Date {
  const brazilianMoment = moment.tz(date, BRAZIL_TIMEZONE);
  
  const normalizedBrazilianMoment = brazilianMoment.startOf('day');
  
  return normalizedBrazilianMoment.toDate();
}

export function formatDateInBrazilianTimezone(date: string | Date | moment.Moment): string {
  return moment.tz(date, BRAZIL_TIMEZONE).format('YYYY-MM-DD HH:mm:ss [BRT]');
}

export function isSameDayInBrazilianTimezone(
  date1: string | Date | moment.Moment, 
  date2: string | Date | moment.Moment
): boolean {
  const moment1 = moment.tz(date1, BRAZIL_TIMEZONE);
  const moment2 = moment.tz(date2, BRAZIL_TIMEZONE);
  
  return moment1.format('YYYY-MM-DD') === moment2.format('YYYY-MM-DD');
}