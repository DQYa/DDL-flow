import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import type { DDL, Priority, Project } from '../types';
import { updateDDL } from '../utils/storage';
import { formatDateTime } from '../utils/date';

interface Props {
  ddl: DDL;
  project: Project;
  onClose: () => void;
  onSaved: (ddl: DDL) => void;
  onDelete: (id: string) => void;
}

const PRIORITIES = ['高', '中', '低'] as const;

function getOriginalText(ddl: DDL, project: Project) {
  return ddl.originalText || project.originalText || '';
}

function statusLabel(ddl: DDL) {
  return ddl.completed ? '已完成' : '未完成';
}

function toDateTimeLocal(value: string) {
  return dayjs(value).format('YYYY-MM-DDTHH:mm');
}

export default function DDLDetailModal({ ddl, project, onClose, onSaved, onDelete }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: ddl.title,
    deadline: toDateTimeLocal(ddl.deadline),
    priority: ddl.priority,
    category: ddl.category || project.category || '',
    description: ddl.description || '',
    originalText: getOriginalText(ddl, project),
    location: ddl.location || '',
    completed: ddl.completed,
  });

  const copyOriginalText = async () => {
    const originalText = getOriginalText(ddl, project);
    if (!originalText) return;
    await navigator.clipboard?.writeText(originalText);
    setNotice('原通知已复制');
  };

  const handleCancel = () => {
    setForm({
      title: ddl.title,
      deadline: toDateTimeLocal(ddl.deadline),
      priority: ddl.priority,
      category: ddl.category || project.category || '',
      description: ddl.description || '',
      originalText: getOriginalText(ddl, project),
      location: ddl.location || '',
      completed: ddl.completed,
    });
    setError(null);
    setMode('view');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated: DDL = {
        ...ddl,
        title: form.title.trim(),
        deadline: new Date(form.deadline).toISOString(),
        priority: form.priority,
        category: form.category.trim(),
        description: form.description,
        originalText: form.originalText,
        location: form.location,
        completed: form.completed,
        completedAt: form.completed ? (ddl.completedAt || new Date().toISOString()) : undefined,
      };
      await updateDDL(updated);
      setMode('view');
      setNotice('保存成功');
      onSaved(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('DDL detail save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="ddl-detail-overlay bg-[rgba(15,23,42,0.28)] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="ddl-detail-modal ui-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ddl-detail-header">
          <div>
            <p className="ddl-detail-kicker">{project.name}</p>
            <h2>{mode === 'edit' ? '编辑 DDL' : ddl.title}</h2>
          </div>
          <div className="ddl-detail-header-actions">
            {mode === 'view' ? (
              <button type="button" className="ghost" onClick={() => setMode('edit')}>编辑</button>
            ) : (
              <button type="button" className="ghost" onClick={handleCancel}>取消</button>
            )}
            <button type="button" className="ghost" onClick={onClose}>关闭</button>
          </div>
        </div>

        {notice && <div className="ddl-detail-notice">{notice}</div>}
        {error && <div className="ddl-detail-error">{error}</div>}

        {mode === 'edit' ? (
          <div className="ddl-edit-form">
            <label><span>标题</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label><span>截止时间</span><input type="datetime-local" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
            <label><span>优先级</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            <label><span>分类</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
            <label><span>地点/位置</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="教室、会议室、线上会议等" /></label>
            <label><span>状态</span><select value={form.completed ? 'done' : 'todo'} onChange={(event) => setForm({ ...form, completed: event.target.value === 'done' })}><option value="todo">未完成</option><option value="done">已完成</option></select></label>
            <label className="wide"><span>描述</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></label>
            <label className="wide"><span>原通知</span><textarea value={form.originalText} onChange={(event) => setForm({ ...form, originalText: event.target.value })} rows={7} /></label>
          </div>
        ) : (
          <>
            <p className="ddl-detail-description">{ddl.description || '暂无描述'}</p>
            <dl className="ddl-detail-grid">
              <div><dt>标题</dt><dd>{ddl.title}</dd></div>
              <div><dt>截止时间</dt><dd>{formatDateTime(ddl.deadline)}</dd></div>
              <div><dt>状态</dt><dd>{statusLabel(ddl)}</dd></div>
              <div><dt>优先级</dt><dd><span className="ui-chip ddl-detail-chip">{ddl.priority}</span></dd></div>
              <div><dt>分类</dt><dd>{ddl.category || project.category || '未分类'}</dd></div>
              <div><dt>项目</dt><dd>{project.name}</dd></div>
              <div><dt>地点/位置</dt><dd>{ddl.location || '未识别地点'}</dd></div>
            </dl>
            <section className="ddl-original-section">
              <div className="ddl-original-header">
                <span>原通知</span>
                <button type="button" onClick={copyOriginalText}>复制</button>
              </div>
              <div className="ddl-original-text">
                {getOriginalText(ddl, project) || '暂无原通知'}
              </div>
            </section>
          </>
        )}

        <div className="ddl-detail-actions">
          {mode === 'edit' ? (
            <>
              <button type="button" className="ghost" onClick={handleCancel}>取消</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.title.trim()}>{saving ? '保存中...' : '保存'}</button>
            </>
          ) : (
            <>
              <button type="button" className="ghost" onClick={() => setMode('edit')}>编辑</button>
              <button type="button" className="danger" onClick={() => onDelete(ddl.id)}>删除</button>
            </>
          )}
        </div>
      </motion.section>
    </motion.div>
  );

  return createPortal(modal, document.body);
}
