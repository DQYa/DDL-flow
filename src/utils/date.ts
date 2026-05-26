import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import type { DDL } from '../types';

dayjs.locale('zh-cn');

export function now(): dayjs.Dayjs {
  return dayjs();
}

export function formatDate(date: string, fmt = 'YYYY年M月D日'): string {
  return dayjs(date).format(fmt);
}

export function formatDateTime(date: string): string {
  return dayjs(date).format('YYYY年M月D日 HH:mm');
}

export function formatTime(date: string): string {
  return dayjs(date).format('HH:mm');
}

export function relativeTime(date: string): string {
  const d = dayjs(date);
  const n = now();
  const diffMs = d.diff(n);
  const absDiff = Math.abs(diffMs);

  if (diffMs < 0) {
    const hours = Math.ceil(absDiff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}小时前`;
    const days = Math.ceil(absDiff / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days}天前`;
    return formatDate(date);
  }

  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.floor(absDiff / (1000 * 60));
    return `剩余${mins}分钟`;
  }
  if (hours < 24) return `剩余${hours}小时`;
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  if (days <= 3) return `剩余${days}天`;
  if (days <= 30) return `剩余${days}天`;
  return formatDate(date);
}

export function isOverdue(date: string): boolean {
  return dayjs(date).isBefore(now());
}

export function isToday(date: string): boolean {
  return dayjs(date).isSame(now(), 'day');
}

export function isTomorrow(date: string): boolean {
  return dayjs(date).isSame(now().add(1, 'day'), 'day');
}

export function isPast(date: string): boolean {
  return dayjs(date).isBefore(now(), 'day');
}

export function getDaysUntil(date: string): number {
  return dayjs(date).startOf('day').diff(now().startOf('day'), 'day');
}

export function urgencyLevel(date: string): 'red' | 'yellow' | 'green' {
  const hours = dayjs(date).diff(now(), 'hour');
  if (hours <= 24) return 'red';
  if (hours <= 72) return 'yellow';
  return 'green';
}

export function getMonthDays(year: number, month: number): dayjs.Dayjs[] {
  const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const lastDay = firstDay.endOf('month');
  // Monday-start: 0=Sun => 6, 1=Mon => 0, ..., 6=Sat => 5
  const startPad = (firstDay.day() + 6) % 7;

  const days: dayjs.Dayjs[] = [];

  // Previous month padding
  for (let i = startPad - 1; i >= 0; i--) {
    days.push(firstDay.subtract(i + 1, 'day'));
  }

  // Current month
  for (let i = 0; i < lastDay.date(); i++) {
    days.push(firstDay.add(i, 'day'));
  }

  // Next month padding to fill 6 rows
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push(lastDay.add(i, 'day'));
  }

  return days;
}

export function toISODate(date: dayjs.Dayjs): string {
  return date.format('YYYY-MM-DD');
}

export function ddlsForDate(ddls: DDL[], date: dayjs.Dayjs): DDL[] {
  const dateStr = toISODate(date);
  return ddls.filter(
    (d) => dayjs(d.deadline).format('YYYY-MM-DD') === dateStr && !d.completed
  );
}
