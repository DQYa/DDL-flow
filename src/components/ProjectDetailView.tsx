import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Project, DDL, ParsedResult } from '../types';
import { createDDL, deleteDDLs, deleteProjectWithDDLs, setDDLCompleted } from '../utils/storage';
import { formatDateTime, relativeTime, isPast, urgencyLevel } from '../utils/date';
import dayjs from 'dayjs';
import CreateModal from './CreateModal';
import EditModal from './EditModal';
import { parseWithAI } from '../utils/api';

interface Props {
  project: Project;
  ddls: DDL[];
  onBack: () => void;
  onRefresh: () => void;
  userName: string;
}

export default function ProjectDetailView({ project, ddls, onBack, onRefresh, userName }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addResult, setAddResult] = useState<ParsedResult | null>(null);
  const [addText, setAddText] = useState('');
  const [originalModal, setOriginalModal] = useState<string | null>(null);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);

  // Edit state
  const [editingDDL, setEditingDDL] = useState<DDL | null>(null);

  const incomplete = ddls.filter((d) => !d.completed);
  const completed = ddls.filter((d) => d.completed);
  const progress = ddls.length > 0 ? Math.round((completed.length / ddls.length) * 100) : 0;

  const handleToggle = async (ddlId: string) => {
    const ddl = ddls.find((d) => d.id === ddlId);
    if (!ddl) return;
    await setDDLCompleted(ddl.id, !ddl.completed);
    onRefresh();
  };

  const handleDeleteProject = async () => {
    await deleteProjectWithDDLs(project.id);
    setShowDeleteProjectModal(false);
    onBack();
    onRefresh();
  };

  const handleDeleteDDL = async (ddlId: string) => {
    const ddl = ddls.find((d) => d.id === ddlId);
    const ok = window.confirm(`确定删除任务「${ddl?.title || '未命名任务'}」吗？此操作不可撤销。`);
    if (!ok) return;
    await deleteDDLs([ddlId]);
    onRefresh();
  };

  const handleDirectAdd = async () => {
    if (!addText.trim()) return;
    const now = new Date().toISOString();
    const newDDL: DDL = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: addText.trim(),
      description: '',
      deadline: dayjs().add(1, 'day').hour(23).minute(59).second(0).toISOString(),
      priority: '中',
      category: project.category,
      completed: false,
      createdAt: now,
    };
    await createDDL(newDDL);
    setAddText('');
    onRefresh();
  };

  const handleParseAdd = async () => {
    if (!addText.trim()) return;
    const parsed = await parseWithAI(addText, userName);
    parsed.projectName = project.name;
    if (parsed.ddls.length === 1 && !addText.match(/今晚|明天|后天|周[一二三四五六日]|下?周[一二三四五六日]|\d+月\d+日|\d+:\d+|截止|deadline|前|之前|月底|月初|下月/)) {
      // Simple single task — add directly without modal
      const ddl = parsed.ddls[0];
      const newDDL: DDL = {
        id: crypto.randomUUID(),
        projectId: project.id,
        title: ddl.title,
        description: ddl.description || '',
        deadline: ddl.deadline,
        priority: ddl.priority,
        category: project.category,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      await createDDL(newDDL);
      setAddText('');
      onRefresh();
    } else {
      setAddResult(parsed);
      setShowAddModal(true);
    }
  };

  const priorityColor = (ddl: DDL) => {
    if (ddl.priority === '高') return 'var(--color-red)';
    if (ddl.priority === '中') return 'var(--color-yellow)';
    return 'var(--color-green)';
  };

  const urgencyColor = (ddl: DDL) => {
    const u = isPast(ddl.deadline) ? 'red' : urgencyLevel(ddl.deadline);
    return u === 'red' ? 'var(--color-red)' : u === 'yellow' ? 'var(--color-yellow)' : 'var(--color-green)';
  };

  const nearest = incomplete.sort((a, b) =>
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )[0];

  return (
    <>
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onBack}
          className="ui-icon-button w-8 h-8 flex items-center justify-center bg-[#F8FAFD] border border-[var(--color-border)]
            text-[var(--color-text-secondary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </motion.button>
        <div className="flex-1">
          <h3
            onClick={() => project.originalText && setOriginalModal(project.originalText)}
            className={`text-[16px] font-bold text-[var(--color-text)] ${project.originalText ? 'cursor-pointer hover:text-[var(--color-primary)] transition-colors' : ''}`}
            title={project.originalText ? '点击查看原始通知' : ''}
          >{project.name}</h3>
          <span className="text-[11px] text-[var(--color-text-secondary)]">{project.category} · {progress}%</span>
        </div>
        <button
          onClick={() => setShowDeleteProjectModal(true)}
          className="text-[11px] text-[var(--color-red)]/75 hover:text-[var(--color-red)] transition-colors font-medium px-2 py-1.5 rounded-[6px] hover:bg-[var(--color-red-light)]"
        >
          删除项目
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-1.5 shrink-0" style={{ marginBottom: 2 }}>
        <div className="bg-[#F8FAFD] border border-[var(--color-border)] rounded-[8px] p-3">
          <span className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase">进度</span>
          <div className="flex items-end gap-1.5 mt-0.5">
            <span className="text-[24px] font-bold text-[var(--color-text)]">{progress}%</span>
            <span className="text-[11px] text-[var(--color-text-secondary)] mb-1">{completed.length}/{ddls.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-border)] mt-2 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full bg-[var(--color-primary)]" />
          </div>
        </div>
        {nearest && (
          <div className="bg-[#F8FAFD] border border-[var(--color-border)] rounded-[8px] p-3">
            <span className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase">最近 DDL</span>
            <p className="text-[13px] font-semibold text-[var(--color-text)] mt-0.5 truncate">{nearest.title}</p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">{formatDateTime(nearest.deadline)}</p>
            <p className="text-[12px] font-bold mt-0.5" style={{ color: urgencyColor(nearest) }}>{relativeTime(nearest.deadline)}</p>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto pr-1 mb-4" style={{ paddingTop: 2 }}>
        {incomplete.map((ddl) => (
          <div key={ddl.id} style={{ marginBottom: 2 }}>
            <motion.div
              layout
              onClick={() => setEditingDDL(ddl)}
              className="bg-[#F8FAFD] border border-transparent hover:border-[var(--color-border)] flex overflow-hidden rounded-[8px] cursor-pointer hover:shadow-sm transition-all"
            >
              <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: priorityColor(ddl) }} />
              <div className="flex-1 min-w-0 p-3">
              <div className="flex items-start gap-2.5">
                {/* Checkbox — click to toggle completion */}
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={(e) => { e.stopPropagation(); handleToggle(ddl.id); }}
                  className="mt-0.5 w-[16px] h-[16px] rounded border-2 border-[var(--color-text-muted)] flex items-center justify-center shrink-0
                    hover:border-[var(--color-primary)] transition-colors"
                  title="点击标记完成"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                    className="opacity-0 hover:opacity-100">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </motion.button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-[var(--color-text)]">{ddl.title}</span>
                    <span className={`text-[11px] px-2 py-1 ui-chip font-medium ${
                      ddl.priority === '高' ? 'bg-[var(--color-red-light)] text-[var(--color-red)]' :
                      ddl.priority === '中' ? 'bg-[var(--color-yellow-light)] text-[#C79100]' :
                      'bg-[var(--color-green-light)] text-[#388E3C]'
                    }`}>{ddl.priority}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-[var(--color-text-secondary)]">{formatDateTime(ddl.deadline)}</span>
                    <span className="text-[11px] font-bold" style={{ color: urgencyColor(ddl) }}>{relativeTime(ddl.deadline)}</span>
                  </div>
                  {ddl.description && (
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate opacity-50">
                      {ddl.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDDL(ddl.id); }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-red)] transition-colors p-0.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              </div>
            </motion.div>

          </div>
        ))}
        {incomplete.length === 0 && <p className="text-center py-4 text-[12px] text-[var(--color-text-muted)]">全部完成</p>}

        {/* Completed */}
        {completed.length > 0 && (
          <div style={{ paddingTop: 2 }}>
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium">已完成 ({completed.length})</span>
            {completed.map((ddl) => (
              <motion.div
                key={ddl.id}
                layout
                onClick={() => handleToggle(ddl.id)}
                className="bg-[var(--color-bg)]/50 flex overflow-hidden rounded-r-[4px] opacity-40 grayscale cursor-pointer
                  hover:opacity-70 hover:grayscale-0 transition-all"
                style={{ marginTop: 6 }}
                title="点击取消完成"
              >
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: priorityColor(ddl) }} />
                <div className="flex-1 min-w-0 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-[16px] h-[16px] rounded bg-[var(--color-green)] flex items-center justify-center shrink-0">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <span className="text-[12px] text-[var(--color-text)] line-through">{ddl.title}</span>
                </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add DDL */}
      <div className="shrink-0 bg-[var(--color-primary-light)] rounded-[8px] p-3 border border-[var(--color-primary)]/15" style={{ marginTop: 18 }}>
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span className="text-[11px] font-semibold text-[var(--color-text)]">添加新任务</span>
          <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">Enter 快速添加</span>
        </div>
        <textarea
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleDirectAdd();
            }
          }}
          placeholder="输入标题直接添加，粘贴通知内容可解析日期优先级"
          rows={2}
          className="w-full bg-white/90 resize-none text-[12px] text-[var(--color-text)]
            placeholder:text-[var(--color-text-muted)] outline-none rounded-[7px] p-2.5
            focus:bg-white focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all
            border border-transparent focus:border-[var(--color-primary)]/20 leading-relaxed mb-2"
          style={{ fontFamily: 'inherit' }}
        />
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleParseAdd}
            disabled={!addText.trim()}
            className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-[7px] text-[13px] font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-primary-dark)] transition-colors
              flex items-center gap-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 10 4 15 9 20"/>
              <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
            </svg>
            AI 解析
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleDirectAdd}
            disabled={!addText.trim()}
            className="px-3 py-1.5 bg-white text-[var(--color-text)] rounded-[7px] text-[13px] font-medium
              disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-primary-light)] transition-colors
              border border-[var(--color-border)]"
          >
            直接添加
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && addResult && (
          <CreateModal result={addResult} onConfirm={() => { setAddText(''); setAddResult(null); setShowAddModal(false); onRefresh(); }} onCancel={() => setShowAddModal(false)} />
        )}
        {editingDDL && (
          <EditModal
            ddl={editingDDL}
            onConfirm={() => { setEditingDDL(null); onRefresh(); }}
            onCancel={() => setEditingDDL(null)}
            onDelete={(id) => { handleDeleteDDL(id); setEditingDDL(null); }}
          />
        )}
        {showDeleteProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.28)] backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDeleteProjectModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[420px] bg-white border border-[var(--color-border)] rounded-[8px] shadow-[var(--shadow-panel)]"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-[8px] bg-[var(--color-red-light)] flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v5" />
                      <path d="M14 11v5" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[18px] font-semibold text-[var(--color-text)]">删除项目</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                      确定删除「{project.name}」吗？项目下的 {ddls.length} 个任务也会一起删除，此操作不可撤销。
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowDeleteProjectModal(false)}
                    className="flex-1 py-3 text-[14px] font-medium rounded-[7px] bg-[#F1F5FA] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="flex-1 py-3 text-[14px] font-semibold rounded-[7px] bg-[var(--color-red)] text-white hover:bg-[#C83F3F] transition-colors"
                  >
                    删除项目
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    {/* Original notification modal */}
    <AnimatePresence>
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
