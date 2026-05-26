import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import type { DDL } from '../types';
import { getMonthDays, ddlsForDate, isPast, isToday, toISODate } from '../utils/date';

interface Props {
  ddls: DDL[];
  selectedDate: dayjs.Dayjs;
  onDateSelect: (date: dayjs.Dayjs) => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export default function CalendarModule({ ddls, selectedDate, onDateSelect }: Props) {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [direction, setDirection] = useState(0);

  const year = currentDate.year();
  const month = currentDate.month() + 1;
  const days = getMonthDays(year, month);

  const prevMonth = () => {
    setDirection(-1);
    setCurrentDate((d) => d.subtract(1, 'month'));
  };

  const nextMonth = () => {
    setDirection(1);
    setCurrentDate((d) => d.add(1, 'month'));
  };

  const isCurrentMonth = (day: dayjs.Dayjs) => day.month() + 1 === month;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="ui-panel p-3 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <button
          onClick={prevMonth}
          className="ui-icon-button w-7 h-7 flex items-center justify-center text-[var(--color-text-secondary)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <AnimatePresence mode="wait">
          <motion.span
            key={`${year}-${month}`}
            initial={{ opacity: 0, y: direction * 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction * -6 }}
            transition={{ duration: 0.12 }}
            className="text-[17px] font-semibold text-[var(--color-text)]"
          >
            {year}年{month}月
          </motion.span>
        </AnimatePresence>
        <button
          onClick={nextMonth}
          className="ui-icon-button w-7 h-7 flex items-center justify-center text-[var(--color-text-secondary)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1 shrink-0">
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className={`text-center text-[10px] font-medium py-0.5 ${
              i >= 5 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid - fills remaining space */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`grid-${year}-${month}`}
          initial={{ opacity: 0, x: direction * 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -15 }}
          transition={{ duration: 0.12 }}
          className="grid grid-cols-7 flex-1 auto-rows-fr"
        >
          {days.map((day, i) => {
            const dayDDLs = ddlsForDate(ddls, day);
            const hasDDL = dayDDLs.length > 0;
            const past = isPast(toISODate(day));
            const today = isToday(toISODate(day));
            const inMonth = isCurrentMonth(day);
            const isSelected = day.isSame(selectedDate, 'day');

            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  onDateSelect(day);
                  if (!inMonth) setCurrentDate(day);
                }}
                className={`relative flex flex-col items-center justify-center rounded-lg
                  transition-colors duration-150 mx-px my-px
                  ${isSelected
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : today
                      ? 'bg-[var(--color-primary-light)] ring-1 ring-[var(--color-primary)]/35'
                      : 'hover:bg-[#F1F5FA]'
                  }
                  ${!inMonth ? 'opacity-20' : ''}
                  ${past && !today && inMonth ? 'opacity-40' : ''}
                `}
              >
                <span
                  className={`text-[13px] leading-none
                    ${hasDDL && inMonth && !past && !isSelected ? 'text-[var(--color-red)] font-extrabold' : ''}
                    ${hasDDL && inMonth && !past && isSelected ? 'font-extrabold' : ''}
                    ${isSelected ? 'text-white' : ''}
                    ${!isSelected && today ? 'text-[var(--color-primary-dark)] font-bold' : ''}
                    ${!isSelected && !today && !past && !hasDDL && inMonth ? 'text-[var(--color-text)]' : ''}
                  `}
                >
                  {day.date()}
                </span>
                {hasDDL && inMonth && (
                  <div className="flex gap-px mt-px">
                    {dayDDLs.slice(0, 3).map((ddl) => (
                      <span
                        key={ddl.id}
                        className={`w-[3px] h-[3px] rounded-full ${
                          isSelected ? 'bg-white/80' :
                          ddl.priority === '高' ? 'bg-[var(--color-red)]' :
                          ddl.priority === '中' ? 'bg-[var(--color-yellow)]' :
                          'bg-[var(--color-green)]'
                        }`}
                      />
                    ))}
                    {dayDDLs.length > 3 && (
                      <span className={`text-[7px] leading-none ${isSelected ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                        +{dayDDLs.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
