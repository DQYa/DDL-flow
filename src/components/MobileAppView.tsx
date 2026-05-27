import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dayjs from 'dayjs';
import type { DDL, ParsedResult, Priority, Project } from '../types';
import { deleteDDLs, setDDLCompleted, updateDDL } from '../utils/storage';
import { formatDateTime, relativeTime } from '../utils/date';
import { getAIStatus, parseWithAI } from '../utils/api';
import { supabase } from '../lib/supabase';
import CreateModal from './CreateModal';
import AISettingsModal from './AISettingsModal';

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

const PRIORITIES = ['高', '中', '低'] as const;

function getProject(projects: Project[], projectId: string) {
  return projects.find((project) => project.id === projectId);
}

function getOriginalText(ddl: DDL, project?: Project) {
  return ddl.originalText || project?.originalText || '';
}

function getStatus(ddl: DDL) {
  if (ddl.completed) {
    return { label: '已完成', className: 'mobile-status mobile-status-done' };
  }

  const hours = dayjs(ddl.deadline).diff(dayjs(), 'hour', true);
  if (hours < 0) return { label: '已逾期', className: 'mobile-status mobile-status-overdue' };
  if (hours <= 24) return { label: '24小时内', className: 'mobile-status mobile-status-soon' };
  if (hours <= 72) return { label: '3天内', className: 'mobile-status mobile-status-week' };
  return { label: '正常', className: 'mobile-status mobile-status-normal' };
}

function getPriorityClass(priority: string) {
  if (/high|高|楂/i.test(priority)) return 'mobile-priority mobile-priority-high';
  if (/medium|中|涓/i.test(priority)) return 'mobile-priority mobile-priority-medium';
  return 'mobile-priority mobile-priority-low';
}

function toDateTimeLocal(value: string) {
  return dayjs(value).format('YYYY-MM-DDTHH:mm');
}

export default function MobileAppView({ userName, userEmail, projects, ddls, todayCount, onRefresh, onSignOut }: Props) {
  const [activeTab, setActiveTab] = useState<MobileTab>('today');
  const [selectedDDL, setSelectedDDL] = useState<DDL | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiConfigured, setAIConfigured] = useState(() => getAIStatus().configured);
  const [addText, setAddText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    deadline: '',
    priority: '中' as Priority,
    category: '',
    description: '',
    originalText: '',
    location: '',
    completed: false,
  });

  useEffect(() => {
    const handleUpdate = () => setAIConfigured(getAIStatus().configured);
    window.addEventListener('ddlflow-ai-config-updated', handleUpdate);
    return () => window.removeEventListener('ddlflow-ai-config-updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (!selectedDDL) return;
    const latest = ddls.find((ddl) => ddl.id === selectedDDL.id);
    if (latest && latest !== selectedDDL) {
      setSelectedDDL(latest);
    }
  }, [ddls, selectedDDL]);

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

  const openDetail = (ddl: DDL) => {
    const project = getProject(projects, ddl.projectId);
    setSelectedDDL(ddl);
    setIsEditing(false);
    setSaveError(null);
    setSaveNotice(null);
    setEditForm({
      title: ddl.title,
      deadline: toDateTimeLocal(ddl.deadline),
      priority: ddl.priority,
      category: ddl.category || project?.category || '',
      description: ddl.description || '',
      originalText: getOriginalText(ddl, project),
      location: ddl.location || '',
      completed: ddl.completed,
    });
  };

  const closeDetail = () => {
    setSelectedDDL(null);
    setIsEditing(false);
    setSaveError(null);
    setSaveNotice(null);
  };

  const handleToggle = async (ddl: DDL) => {
    setSaving(true);
    setSaveError(null);
    try {
      await setDDLCompleted(ddl.id, !ddl.completed);
      onRefresh();
      closeDetail();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(message);
      console.error('Mobile detail completion toggle failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ddl: DDL) => {
    const ok = window.confirm(`确定删除任务「${ddl.title || '未命名任务'}」吗？此操作不可撤销。`);
    if (!ok) return;
    await deleteDDLs([ddl.id]);
    setSelectedDDL(null);
    onRefresh();
  };

  const handleSave = async () => {
    if (!selectedDDL || !editForm.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const updated: DDL = {
        ...selectedDDL,
        title: editForm.title.trim(),
        deadline: new Date(editForm.deadline).toISOString(),
        priority: editForm.priority,
        category: editForm.category.trim(),
        description: editForm.description,
        originalText: editForm.originalText,
        location: editForm.location,
        completed: editForm.completed,
        completedAt: editForm.completed ? (selectedDDL.completedAt || new Date().toISOString()) : undefined,
      };
      await updateDDL(updated);
      setSelectedDDL(updated);
      setIsEditing(false);
      setSaveNotice('保存成功');
      onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(message);
      console.error('Mobile detail save failed:', err);
    } finally {
      setSaving(false);
    }
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

  const closeAccountSheet = () => {
    setShowAccountSheet(false);
    setAccountPassword('');
    setAccountPasswordConfirm('');
    setAccountError(null);
    setAccountNotice(null);
  };

  const handlePasswordUpdate = async () => {
    setAccountError(null);
    setAccountNotice(null);

    if (!accountPassword) {
      setAccountError('请输入新密码');
      return;
    }

    if (accountPassword !== accountPasswordConfirm) {
      setAccountError('两次输入的密码不一致');
      return;
    }

    setAccountSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: accountPassword });
      if (error) throw error;
      setAccountPassword('');
      setAccountPasswordConfirm('');
      setAccountNotice('密码修改成功');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAccountError(message);
      console.error('Mobile password update failed:', err);
    } finally {
      setAccountSaving(false);
    }
  };

  const copyOriginalText = async () => {
    if (!selectedDDL) return;
    const project = getProject(projects, selectedDDL.projectId);
    const originalText = getOriginalText(selectedDDL, project);
    if (!originalText) return;
    await navigator.clipboard?.writeText(originalText);
    setSaveNotice('原通知已复制');
  };

  return (
    <div className="mobile-app">
      <header className="mobile-header">
        <div className="mobile-header-title">
          <h1>DDL Flow</h1>
          <p className="mobile-user-email">{userEmail}</p>
          <p>{todayCount} 个今日任务</p>
        </div>
        <div className="mobile-header-actions">
          <button
            type="button"
            className={`mobile-api-button ${aiConfigured ? 'is-configured' : 'is-missing'}`}
            onClick={() => setShowAISettings(true)}
            title={aiConfigured ? 'AI 已配置' : 'AI 未配置'}
          >
            API
            {!aiConfigured && <span />}
          </button>
          <button
            type="button"
            className="mobile-account-button"
            onClick={() => setShowAccountSheet(true)}
            aria-label="账号设置"
            title="账号设置"
          >
            D
          </button>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="项目分类">
        <button className={activeTab === 'today' ? 'is-active' : ''} onClick={() => setActiveTab('today')}>今日</button>
        <button className={activeTab === 'all' ? 'is-active' : ''} onClick={() => setActiveTab('all')}>全部</button>
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
                onClick={() => openDetail(ddl)}
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
                  {ddl.location && <span>{ddl.location}</span>}
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
            onClick={closeDetail}
          >
            <motion.section
              className="mobile-bottom-sheet mobile-detail-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-sheet-handle" />
              <div className="mobile-detail-header">
                <button type="button" className="mobile-detail-back" onClick={closeDetail} aria-label="返回任务列表">←</button>
                <h2>{isEditing ? '编辑 DDL' : selectedDDL.title}</h2>
                <button type="button" className="ghost" onClick={() => setIsEditing((value) => !value)}>
                  {isEditing ? '取消编辑' : '编辑'}
                </button>
              </div>

              {saveNotice && <div className="mobile-save-notice">{saveNotice}</div>}
              {saveError && <div className="mobile-save-error">{saveError}</div>}

              {isEditing ? (
                <div className="mobile-edit-form">
                  <label><span>标题</span><input value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></label>
                  <label><span>截止时间</span><input type="datetime-local" value={editForm.deadline} onChange={(event) => setEditForm({ ...editForm, deadline: event.target.value })} /></label>
                  <label><span>优先级</span><select value={editForm.priority} onChange={(event) => setEditForm({ ...editForm, priority: event.target.value as Priority })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
                  <label><span>分类</span><input value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} /></label>
                  <label><span>地点</span><input value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} placeholder="教室、会议室、线上会议等" /></label>
                  <label><span>状态</span><select value={editForm.completed ? 'done' : 'todo'} onChange={(event) => setEditForm({ ...editForm, completed: event.target.value === 'done' })}><option value="todo">未完成</option><option value="done">已完成</option></select></label>
                  <label className="wide"><span>描述</span><textarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} rows={4} /></label>
                  <label className="wide"><span>原通知</span><textarea value={editForm.originalText} onChange={(event) => setEditForm({ ...editForm, originalText: event.target.value })} rows={7} /></label>
                </div>
              ) : (
                <>
                  <p className="mobile-sheet-description">{selectedDDL.description || '暂无描述'}</p>
                  <dl className="mobile-detail-grid">
                    <div><dt>标题</dt><dd>{selectedDDL.title}</dd></div>
                    <div><dt>截止时间</dt><dd>{formatDateTime(selectedDDL.deadline)}</dd></div>
                    <div><dt>状态</dt><dd>{getStatus(selectedDDL).label}</dd></div>
                    <div><dt>优先级</dt><dd>{selectedDDL.priority}</dd></div>
                    <div><dt>分类</dt><dd>{getProject(projects, selectedDDL.projectId)?.category || selectedDDL.category || '未分类'}</dd></div>
                    <div><dt>项目</dt><dd>{getProject(projects, selectedDDL.projectId)?.name || '未归档项目'}</dd></div>
                    <div><dt>地点</dt><dd>{selectedDDL.location || '未识别地点'}</dd></div>
                  </dl>
                  <section className="mobile-original-section">
                    <div className="mobile-original-header">
                      <span>原通知</span>
                      <button type="button" onClick={copyOriginalText}>复制</button>
                    </div>
                    <div className="mobile-original-text">
                      {getOriginalText(selectedDDL, getProject(projects, selectedDDL.projectId)) || '暂无原通知'}
                    </div>
                  </section>
                </>
              )}

              <div className="mobile-sheet-actions">
                {isEditing ? (
                  <button type="button" onClick={handleSave} disabled={saving || !editForm.title.trim()}>
                    {saving ? '保存中...' : '保存'}
                  </button>
                ) : (
                  <button type="button" onClick={() => handleToggle(selectedDDL)} disabled={saving}>
                    {saving ? '保存中...' : selectedDDL.completed ? '取消完成' : '完成'}
                  </button>
                )}
                <button type="button" className="danger" onClick={() => handleDelete(selectedDDL)}>删除</button>
              </div>
            </motion.section>
          </motion.div>
        )}

        {showAISettings && (
          <AISettingsModal
            onClose={() => setShowAISettings(false)}
            onSaved={() => setAIConfigured(getAIStatus().configured)}
          />
        )}

        {showAccountSheet && (
          <motion.div
            className="mobile-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAccountSheet}
          >
            <motion.section
              className="mobile-bottom-sheet mobile-account-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-sheet-handle" />
              <div className="mobile-account-header">
                <div>
                  <span className="mobile-account-mark">D</span>
                  <h2>账号设置</h2>
                </div>
                <button type="button" className="mobile-account-close" onClick={closeAccountSheet} aria-label="关闭">×</button>
              </div>

              <div className="mobile-account-email">
                <span>当前邮箱</span>
                <strong>{userEmail}</strong>
              </div>

              <div className="mobile-account-fields">
                <label>
                  <span>新密码</span>
                  <input
                    type="password"
                    value={accountPassword}
                    onChange={(event) => setAccountPassword(event.target.value)}
                    placeholder="输入新密码"
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  <span>确认新密码</span>
                  <input
                    type="password"
                    value={accountPasswordConfirm}
                    onChange={(event) => setAccountPasswordConfirm(event.target.value)}
                    placeholder="再次输入新密码"
                    autoComplete="new-password"
                  />
                </label>
              </div>

              {accountError && <div className="mobile-account-message is-error">{accountError}</div>}
              {accountNotice && <div className="mobile-account-message is-notice">{accountNotice}</div>}

              <div className="mobile-account-actions">
                <button type="button" onClick={handlePasswordUpdate} disabled={accountSaving}>
                  {accountSaving ? '修改中...' : '修改密码'}
                </button>
                <button type="button" className="secondary" onClick={onSignOut}>退出登录</button>
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
                placeholder="粘贴通知、作业或待办内容，AI 会识别任务、截止时间和地点"
                rows={5}
              />
              <div className="mobile-sheet-actions">
                <button type="button" onClick={handleParse} disabled={!addText.trim() || parsing}>
                  {parsing ? '识别中...' : 'AI 识别 DDL'}
                </button>
                <button type="button" className="ghost" onClick={() => setShowAddSheet(false)}>取消</button>
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
