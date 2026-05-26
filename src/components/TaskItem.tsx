import { motion } from 'framer-motion';
import type { DDL } from '../types';
import { relativeTime, formatDateTime, isPast, urgencyLevel } from '../utils/date';

interface Props {
  ddl: DDL;
  projectName: string;
  onToggle: (id: string) => void;
  onProjectClick: () => void;
  onShowOriginal: () => void;
}

const priorityLabel: Record<string, string> = {
  '低': '低',
  '中': '中',
  '高': '高',
};

const priorityBg: Record<string, string> = {
  '低': 'var(--color-green-light)',
  '中': 'var(--color-yellow-light)',
  '高': 'var(--color-red-light)',
};

const priorityText: Record<string, string> = {
  '低': '#388E3C',
  '中': '#C79100',
  '高': '#D32F2F',
};

export default function TaskItem({ ddl, projectName, onToggle, onProjectClick, onShowOriginal }: Props) {
  const isCompleted = ddl.completed;
  const timeUrgency = isPast(ddl.deadline) ? 'red' : urgencyLevel(ddl.deadline);

  const leftBarColor = ddl.priority === '高'
    ? 'var(--color-red)'
    : ddl.priority === '中'
      ? 'var(--color-yellow)'
      : 'var(--color-green)';

  const timeColor = timeUrgency === 'red'
    ? 'var(--color-red)'
    : timeUrgency === 'yellow'
      ? 'var(--color-yellow)'
      : 'var(--color-green)';


  // Single click: open project detail
  const handleClick = () => {
    onProjectClick();
  };

  // Double click: show original notification
  const handleDoubleClick = () => {
    onShowOriginal();
  };

  return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={`ddl-task-card flex overflow-hidden transition-all duration-200 cursor-pointer
          hover:bg-white select-none
          ${isCompleted ? 'opacity-35 grayscale' : ''}
        `}
        title="单击打开项目 · 双击查看原始通知"
      >
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: isCompleted ? 'var(--color-text-muted)' : leftBarColor }} />
        <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Checkbox */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(ddl.id);
                }}
                className={`w-[16px] h-[16px] rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-all ${
                  isCompleted
                    ? 'bg-[var(--color-green)] border-[var(--color-green)]'
                  : 'border-[var(--color-text-muted)] hover:border-[var(--color-primary)]'
                }`}
              >
                {isCompleted && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </button>

              <span
                className={`text-[13px] font-medium truncate ${
                  isCompleted
                    ? 'line-through text-[var(--color-text-muted)]'
                    : 'text-[var(--color-text)]'
                }`}
              >
                {ddl.title}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 ml-[24px]">
              <span className="text-[11px] text-[var(--color-text-muted)]">{projectName}</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">·</span>
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                {formatDateTime(ddl.deadline)}
              </span>
            </div>
            {ddl.description && (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 ml-[24px] truncate opacity-60">
                {ddl.description}
              </p>
            )}
            {ddl.location && (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 ml-[24px] truncate opacity-70">
                {ddl.location}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-[11px] px-2 py-1 ui-chip font-medium"
              style={{
                backgroundColor: isCompleted ? 'var(--color-border)' : (priorityBg[ddl.priority] || 'var(--color-primary-light)'),
                color: isCompleted ? 'var(--color-text-muted)' : (priorityText[ddl.priority] || 'var(--color-primary-dark)'),
              }}
            >
              {priorityLabel[ddl.priority]}
            </span>
            {!isCompleted && (
              <span className="text-[11px] font-bold" style={{ color: timeColor }}>
                {relativeTime(ddl.deadline)}
              </span>
            )}
          </div>
        </div>
        </div>
      </motion.div>
  );
}
