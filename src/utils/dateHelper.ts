import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export type Period = 'daily' | 'weekly' | 'monthly';

/**
 * 获取当前周期的起始时间
 */
export function getPeriodStart(period: Period, date?: Date): Date {
  const now = dayjs(date);

  switch (period) {
    case 'daily':
      return now.startOf('day').toDate();
    case 'weekly':
      return now.startOf('isoWeek').toDate(); // 周一为一周开始
    case 'monthly':
      return now.startOf('month').toDate();
  }
}

/**
 * 获取当前周期的结束时间
 */
export function getPeriodEnd(period: Period, date?: Date): Date {
  const now = dayjs(date);

  switch (period) {
    case 'daily':
      return now.endOf('day').add(1, 'millisecond').toDate();
    case 'weekly':
      return now.endOf('isoWeek').add(1, 'millisecond').toDate();
    case 'monthly':
      return now.endOf('month').add(1, 'millisecond').toDate();
  }
}

/**
 * 获取周期范围（起始+结束）
 */
export function getPeriodRange(period: Period, date?: Date) {
  return {
    startDate: getPeriodStart(period, date),
    endDate: getPeriodEnd(period, date),
  };
}
