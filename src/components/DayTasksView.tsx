import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import type { DDL, Project } from '../types';
import { deleteDDLs, setDDLCompleted } from '../utils/storage';
import TaskItem from './TaskItem';
import DDLDetailModal from './DDLDetailModal';

interface Props {
  date: dayjs.Dayjs;
  ddls: DDL[];
  projects: Project[];
  onRefresh: () => void;
  onProjectClick: (project: Project) => void;
}

export default function DayTasksView({ date, ddls, projects, onRefresh, onProjectClick }: Props) {
  const [originalModal, setOriginalModal] = useState<string | null>(null);
  const [selectedDDL, setSelectedDDL] = useState<DDL | null>(null);
  const isToday = date.isSame(dayjs(), 'day');
  const getProject = (projectId: string) => projects.find((p) => p.id === projectId);

  const grouped = new Map<string, { project: Project; ddls: DDL[] }>();
  for (const ddl of ddls) {
    const project = getProject(ddl.projectId);
    if (!project) continue;
    if (!grouped.has(ddl.projectId)) {
      grouped.set(ddl.projectId, { project, ddls: [] });
    }
    grouped.get(ddl.projectId)!.ddls.push(ddl);
  }

  for (const [, group] of grouped) {
    group.ddls.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }

  const groups = Array.from(grouped.values());
  const incompleteCount = ddls.filter((d) => !d.completed).length;

  const handleToggle = async (ddlId: string) => {
    const ddl = ddls.find((d) => d.id === ddlId);
    if (!ddl) return;
    await setDDLCompleted(ddl.id, !ddl.completed);
    onRefresh();
  };

  const handleDeleteDDL = async (ddlId: string) => {
    await deleteDDLs([ddlId]);
    setSelectedDDL(null);
    onRefresh();
  };

  return (
    <>
    <AnimatePresence mode="wait">
      <motion.div
        key={date.format('YYYY-MM-DD')}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15 }}
      >
        {/* Date header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-[18px] font-semibold text-[var(--color-text)]">
              {date.format('M月D日')}
            </h3>
            <span className="text-[13px] text-[var(--color-text-secondary)]">{date.format('dddd')}</span>
            {isToday && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-medium">
                今天
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
            {incompleteCount} 待完成 · {ddls.filter((d) => d.completed).length} 已完成
          </p>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-[8px] bg-[var(--color-primary-light)] flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p className="text-[14px] text-[var(--color-text-secondary)] font-medium">当天暂无 DDL 任务</p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              {isToday ? '今天没有截止的任务' : `${date.format('M月D日')}没有截止的任务`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map(({ project, ddls: projectDDLs }) => (
              <div key={project.id} className="bg-[#F8FAFD] border border-[var(--color-border)] rounded-[8px] overflow-hidden">
                {/* Project group header - clickable */}
                <button
                  onClick={() => onProjectClick(project)}
                  className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-white transition-colors"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        project.category === '比赛' || project.category === '考试'
                          ? 'var(--color-red)'
                          : 'var(--color-primary)',
                    }}
                  />
                  <span className="text-[12px] font-semibold text-[var(--color-text)]">{project.name}</span>
                  <span className="text-[11px] px-2 py-1 ui-chip bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-medium ml-auto">
                    {project.category}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>

                {/* Tasks */}
                <div className="divide-y divide-[var(--color-border)]/50">
                  {projectDDLs.map((ddl) => (
                    <TaskItem
                      key={ddl.id}
                      ddl={ddl}
                      projectName={project.name}
                      onToggle={handleToggle}
                      onProjectClick={() => setSelectedDDL(ddl)}
                      onShowOriginal={() => setOriginalModal(project.originalText)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>

    {/* Original notification modal */}
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
      {originalModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setOriginalModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[8px] shadow-[var(--shadow-panel)] mx-4"
            style={{ width: 720, maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="p-9">
              <h3 className="text-[24px] font-semibold text-[var(--color-text)] mb-7">原始通知</h3>
              <div className="bg-[var(--color-bg)] p-5 text-[16px] text-[var(--color-text-secondary)]
                whitespace-pre-wrap leading-relaxed border border-[var(--color-border)]">
                {originalModal}
              </div>
              <div className="mt-7 flex gap-4">
                <button
                  onClick={() => setOriginalModal(null)}
                  className="flex-1 py-3.5 text-[16px] font-medium rounded-[4px] bg-[var(--color-bg)]
                    text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
