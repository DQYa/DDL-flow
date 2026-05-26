import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dayjs from 'dayjs';
import type { DDL, ParsedResult, Project } from '../types';
import { deleteDDLs, setDDLCompleted } from '../utils/storage';
import { formatDateTime, relativeTime } from '../utils/date';
import { parseWithAI } from '../utils/api';
import CreateModal from './CreateModal';

interface Props {
  userName: string;
  userEmail: string;
  projects: Project[];
  ddls: DDL[];
  todayCount: number;
  onRefresh: () => void;
  onSignOut: () => void;
}

type MobileTab = 'today' | 'all' | string;

function getProject(projects: Project[], projectId: string) {
  return projects.find((project) => project.id === projectId);
}

function getStatus(ddl: DDL) {
  if (ddl.completed) {
    return { label: '已完成', className: 'mobile-status mobile-status-done' };
  }

  const hours = dayjs(ddl.deadline).diff(dayjs(), 'hour', true);
  if (hours < 0) return { label: '已逾期', className: 'mobile-status mobile-status-overdue' };
  if (hours <= 24) return { label: '24小时内', className: 'mobile-status mobile-status-soon' };
  if (hours <= 72) return { label: '3天内', className: 'mobile-status mobile-status-week' };
  return { label: '普通', className: 'mobile-status mobile-status-normal' };
}

function getPriorityClass(priority: string) {
  if (/high|高|楂/i.test(priority)) return 'mobile-priority mobile-priority-high';
  if (/medium|中|涓/i.test(priority)) return 'mobile-priority mobile-priority-medium';
  return 'mobile-priority mobile-priority-low';
}

export default function MobileAppView({ userName, userEmail, projects, ddls, todayCount, onRefresh, onSignOut }: Props) {
  const [activeTab, setActiveTab] = useState<MobileTab>('today');
  const [selectedDDL, setSelectedDDL] = useState<DDL | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addText, setAddText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);

  const visibleProjects = useMemo(() => {
    return projects.filter((project) => ddls.some((ddl) => ddl.projectId === project.id));
  }, [ddls, projects]);

  const visibleDDLs = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const source = activeTab === 'today'
      ? ddls.filter((ddl) => dayjs(ddl.deadline).format('YYYY-MM-DD') === today)
      : activeTab === 'all'
        ? ddls
        : ddls.filter((ddl) => ddl.projectId === activeTab);

    return [...source].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [activeTab, ddls]);

  const handleToggle = async (ddl: DDL) => {
    await setDDLCompleted(ddl.id, !ddl.completed);
    onRefresh();
    setSelectedDDL((current) => current && current.id === ddl.id ? { ...current, completed: !ddl.completed } : current);
  };

  const handleDelete = async (ddl: DDL) => {
    const ok = window.confirm(`确定删除任务「${ddl.title || '未命名任务'}」吗？此操作不可撤销。`);
    if (!ok) return;
    await deleteDDLs([ddl.id]);
    setSelectedDDL(null);
    onRefresh();
  };

  const handleParse = async () => {
    if (!addText.trim()) return;
    setParsing(true);
    try {
      const parsed = await parseWithAI(addText, userName);
      setParsedResult(parsed);
      setShowAddSheet(false);
    } finally {
      setParsing(false);
    }
  };

  const closeCreateModal = () => {
    setParsedResult(null);
    setAddText('');
    onRefresh();
  };

  return (
    <div className="mobile-app">
      <header className="mobile-header">
        <div>
          <h1>DDL Flow</h1>
          <p className="mobile-user-email">{userEmail}</p>
          <p>{todayCount} 个今日任务</p>
        </div>
        <button type="button" className="mobile-logout" onClick={onSignOut}>退出</button>
        <div className="mobile-header-count">{todayCount}</div>
      </header>

      <nav className="mobile-tabs" aria-label="项目分类">
        <button
          className={activeTab === 'today' ? 'is-active' : ''}
          onClick={() => setActiveTab('today')}
        >
          今日
        </button>
        <button
          className={activeTab === 'all' ? 'is-active' : ''}
          onClick={() => setActiveTab('all')}
        >
          全部
        </button>
        {visibleProjects.map((project) => (
          <button
            key={project.id}
            className={activeTab === project.id ? 'is-active' : ''}
            onClick={() => setActiveTab(project.id)}
          >
            {project.name}
          </button>
        ))}
      </nav>

      <main className="mobile-task-list">
        {visibleDDLs.length === 0 ? (
          <div className="mobile-empty">
            <span>今天很清爽</span>
            <p>点右下角按钮添加或识别新的 DDL。</p>
          </div>
        ) : (
          visibleDDLs.map((ddl) => {
            const project = getProject(projects, ddl.projectId);
            const status = getStatus(ddl);
            return (
              <motion.button
                key={ddl.id}
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => setSelectedDDL(ddl)}
                className={`mobile-task-card ${ddl.completed ? 'is-completed' : ''}`}
              >
                <div className="mobile-task-card-top">
                  <span className="mobile-task-title">{ddl.title}</span>
                  <span className={getPriorityClass(ddl.priority)}>{ddl.priority}</span>
                </div>
                <p className="mobile-deadline">{formatDateTime(ddl.deadline)} · {relativeTime(ddl.deadline)}</p>
                <div className="mobile-card-tags">
                  <span>{project?.category || ddl.category || '未分类'}</span>
                  <span>{project?.name || '未归档项目'}</span>
                  <span className={status.className}>{status.label}</span>
                </div>
              </motion.button>
            );
          })
        )}
      </main>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        className="mobile-fab"
        onClick={() => setShowAddSheet(true)}
        aria-label="新增任务"
      >
        +
      </motion.button>

      <AnimatePresence>
        {selectedDDL && (
          <motion.div
            className="mobile-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDDL(null)}
          >
            <motion.section
              className="mobile-bottom-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-sheet-handle" />
              <h2>{selectedDDL.title}</h2>
              <p className="mobile-sheet-description">{selectedDDL.description || '暂无描述'}</p>
              <dl className="mobile-detail-grid">
                <div><dt>截止时间</dt><dd>{formatDateTime(selectedDDL.deadline)}</dd></div>
                <div><dt>优先级</dt><dd>{selectedDDL.priority}</dd></div>
                <div><dt>分类</dt><dd>{getProject(projects, selectedDDL.projectId)?.category || selectedDDL.category || '未分类'}</dd></div>
                <div><dt>状态</dt><dd>{getStatus(selectedDDL).label}</dd></div>
              </dl>
              <div className="mobile-sheet-actions">
                <button type="button" onClick={() => handleToggle(selectedDDL)}>
                  {selectedDDL.completed ? '取消完成' : '完成任务'}
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(selectedDDL)}>
                  删除
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}

        {showAddSheet && (
          <motion.div
            className="mobile-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddSheet(false)}
          >
            <motion.section
              className="mobile-bottom-sheet mobile-add-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-sheet-handle" />
              <h2>新增 DDL</h2>
              <textarea
                value={addText}
                onChange={(event) => setAddText(event.target.value)}
                placeholder="粘贴通知、作业或待办内容，AI 会识别任务和截止时间"
                rows={5}
              />
              <div className="mobile-sheet-actions">
                <button type="button" onClick={handleParse} disabled={!addText.trim() || parsing}>
                  {parsing ? '识别中...' : 'AI 识别 DDL'}
                </button>
                <button type="button" className="ghost" onClick={() => setShowAddSheet(false)}>
                  取消
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}

        {parsedResult && (
          <CreateModal result={parsedResult} onConfirm={closeCreateModal} onCancel={() => setParsedResult(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
