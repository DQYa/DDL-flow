import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DDL, Project } from '../types';
import { relativeTime, formatDateTime, isPast, urgencyLevel } from '../utils/date';
import { deleteDDLs, setDDLCompleted } from '../utils/storage';
import DDLDetailModal from './DDLDetailModal';

interface Props {
  ddls: DDL[];
  projects: Project[];
  onRefresh: () => void;
  onProjectClick: (project: Project) => void;
}

export default function TimelineModule({ ddls, projects, onRefresh, onProjectClick }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');
  const [selectedDDL, setSelectedDDL] = useState<DDL | null>(null);
  const clickTimer = useRef<number | null>(null);

  const getProject = (projectId: string) => projects.find((p) => p.id === projectId);
  const getProjectName = (projectId: string) => getProject(projectId)?.name || '未知';

  const priorityOrder: Record<string, number> = { 高: 0, 中: 1, 低: 2, '楂?': 0, '涓?': 1, '浣?': 2 };

  const allCategories = Array.from(new Set(ddls.map((d) => d.category))).sort();
  const filtered = categoryFilter === '全部' ? ddls : ddls.filter((d) => d.category === categoryFilter);

  const recent = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  const handleToggle = async (e: React.MouseEvent, ddl: DDL) => {
    e.stopPropagation();
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    await setDDLCompleted(ddl.id, !ddl.completed);
    onRefresh();
  };

  const handleCardClick = (ddl: DDL) => {
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      const project = getProject(ddl.projectId);
      if (project) onProjectClick(project);
      clickTimer.current = null;
    }, 180);
  };

  const handleCardDoubleClick = (ddl: DDL) => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setSelectedDDL(ddl);
  };

  const handleDeleteDDL = async (ddlId: string) => {
    await deleteDDLs([ddlId]);
    setSelectedDDL(null);
    onRefresh();
  };

  const priorityColor = (ddl: DDL) => {
    const priority = String(ddl.priority);
    if (['高', '楂?'].includes(priority)) return 'var(--color-red)';
    if (['中', '涓?'].includes(priority)) return 'var(--color-yellow)';
    return 'var(--color-green)';
  };

  const urgencyColor = (ddl: DDL) => {
    const u = isPast(ddl.deadline) ? 'red' : urgencyLevel(ddl.deadline);
    return u === 'red' ? 'var(--color-red)' : u === 'yellow' ? 'var(--color-yellow)' : 'var(--color-green)';
  };

  const tooltipFor = (ddl: DDL) => [
    '单击：查看关联项目',
    '双击：查看关联任务',
    `截止：${formatDateTime(ddl.deadline)}`,
    ddl.location ? `地点：${ddl.location}` : null,
    `优先级：${ddl.priority}`,
    `状态：${ddl.completed ? '已完成' : '未完成'}`,
  ].filter(Boolean).join('\n');

  return (
    <>
      <motion.div whileHover={{ y: -2 }} className="ui-panel p-3 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text)]">DDL 概览</h3>
          <div className="flex items-center gap-2">
            {allCategories.length > 1 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-[11px] px-2 py-1 ui-field text-[var(--color-text-secondary)] outline-none cursor-pointer"
              >
                <option value="全部">全部</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <span className="text-[10px] text-[var(--color-text-muted)]">共 {recent.length} 个</span>
          </div>
        </div>

        {recent.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[12px] text-[var(--color-text-muted)]">暂无 DDL 任务</p>
          </div>
        ) : (
          <div className="flex-1 space-y-1 overflow-y-auto pr-1">
            {recent.map((ddl, i) => {
              const barColor = priorityColor(ddl);
              const timeColor = urgencyColor(ddl);
              return (
                <motion.div
                  key={ddl.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ x: 2 }}
                  onClick={() => handleCardClick(ddl)}
                  onDoubleClick={() => handleCardDoubleClick(ddl)}
                  className={`flex items-center gap-2.5 py-2.5 px-2.5 rounded-[8px] cursor-pointer border border-transparent
                    hover:bg-[#F8FAFD] hover:border-[var(--color-border)] transition-all duration-150 group select-none
                    ${ddl.completed ? 'opacity-40' : ''}`}
                  title={tooltipFor(ddl)}
                >
                  <div className="w-[5px] self-stretch rounded-full shrink-0" style={{ backgroundColor: ddl.completed ? 'var(--color-border)' : barColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[14px] font-medium text-[var(--color-text)] truncate ${ddl.completed ? 'line-through' : ''}`}>
                        {ddl.title}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{getProjectName(ddl.projectId)}</span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">{formatDateTime(ddl.deadline)}</p>
                  </div>
                  <span className="text-[13px] font-bold shrink-0" style={{ color: ddl.completed ? 'var(--color-text-muted)' : timeColor }}>
                    {ddl.completed ? '已完成' : relativeTime(ddl.deadline)}
                  </span>

                  <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => handleToggle(e, ddl)}
                    className={`w-[22px] h-[22px] rounded-[6px] border-2 flex items-center justify-center
                      shrink-0 opacity-60 group-hover:opacity-100 transition-all
                      ${ddl.completed
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]'
                        : 'border-[var(--color-text-muted)] hover:border-[var(--color-primary)]'
                      }`}
                    title={ddl.completed ? '点击取消完成' : '点击标记完成'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"
                      className={ddl.completed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedDDL && getProject(selectedDDL.projectId) && (
          <DDLDetailModal
            ddl={selectedDDL}
            project={getProject(selectedDDL.projectId)!}
            onClose={() => setSelectedDDL(null)}
            onSaved={(updated) => { setSelectedDDL(updated); onRefresh(); }}
            onDelete={handleDeleteDDL}
          />
        )}
      </AnimatePresence>
    </>
  );
}
