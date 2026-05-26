import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import type { Category, ParsedDDL, ParsedResult, Priority } from '../types';
import { createProjectWithDDLs, loadCategories, saveCategories } from '../utils/storage';

interface Props {
  result: ParsedResult;
  onConfirm: () => void;
  onCancel: () => void;
}

const PRIORITIES = ['高', '中', '低'] as const;

function id(): string {
  return crypto.randomUUID();
}

function normalizePriority(priority: string): Priority {
  return priority as Priority;
}

export default function CreateModal({ result, onConfirm, onCancel }: Props) {
  const [projectName, setProjectName] = useState(result.projectName);
  const [category, setCategory] = useState<Category>(result.category);
  const [ddls, setDdls] = useState<ParsedDDL[]>(() =>
    result.ddls.map((ddl) => ({
      ...ddl,
      originalText: ddl.originalText || result.originalText,
      location: ddl.location || '',
    }))
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories().then(setCategories);
  }, []);

  const updateDDL = (index: number, field: keyof ParsedDDL, value: string) => {
    setDdls((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const removeDDL = (index: number) => {
    setDdls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
    setCategory(trimmed);
    setNewCat('');
  };

  const handleRemoveCategory = (cat: string) => {
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    saveCategories(updated);
    if (category === cat) setCategory(updated[0] || '');
  };

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const now = dayjs().toISOString();
      const projectId = id();
      const newProject = {
        id: projectId,
        name: projectName.trim() || '未命名项目',
        category,
        originalText: result.originalText,
        createdAt: now,
      };

      const newDDLs = ddls.map((d) => ({
        id: id(),
        projectId,
        title: d.title.trim() || '未命名任务',
        description: d.description || '',
        originalText: d.originalText || result.originalText,
        location: d.location || '',
        deadline: typeof d.deadline === 'string' ? d.deadline : dayjs(d.deadline).toISOString(),
        priority: normalizePriority(d.priority),
        category,
        completed: false,
        createdAt: now,
      }));

      await createProjectWithDDLs(newProject, newDDLs);
      onConfirm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('CreateModal handleCreate:', err);
    } finally {
      setCreating(false);
    }
  };

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="create-task-overlay"
      onClick={onCancel}
    >
      <motion.section
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="create-task-modal"
      >
        <div className="create-task-aura" />
        <header className="create-task-header">
          <div>
            <h2>✨ AI 已识别任务</h2>
            <p>请确认并补充任务信息</p>
          </div>
          <button type="button" className="create-task-close" onClick={onCancel} aria-label="关闭">×</button>
        </header>

        {error && <div className="create-task-error">{error}</div>}
        {result.parseMode === 'fallback' && (
          <div className={`create-task-fallback-note ${result.confidence === 'low' ? 'is-low' : ''}`}>
            {result.confidence === 'low'
              ? '识别置信度较低，请重点检查标题和时间。'
              : '当前为简易识别模式，建议手动确认时间、地点和任务内容。'}
          </div>
        )}

        <div className="create-task-form create-project-form">
          <label><span>项目名称</span><input value={projectName} onChange={(e) => setProjectName(e.target.value)} /></label>
          <label><span>分类</span><input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
        </div>

        <div className="create-category-row">
          {categories.map((c) => (
            <div key={c} className="relative group">
              <button type="button" onClick={() => setCategory(c)} className={`create-category-pill ${category === c ? 'is-active' : ''}`}>
                {c}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveCategory(c); }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-red)] text-white rounded-full text-[11px]
                  flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                x
              </button>
            </div>
          ))}
          <div className="create-category-add">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }} placeholder="新分类" />
            <button type="button" onClick={handleAddCategory}>+</button>
          </div>
        </div>

        <div className="create-ddl-list">
          {ddls.map((ddl, i) => (
            <section key={i} className="create-ddl-card">
              <div className="create-ddl-card-header">
                <div>
                  <p>DDL #{i + 1}</p>
                  <h3>{ddl.title || '未命名任务'}</h3>
                </div>
                <button
                  type="button"
                  className="create-ddl-remove"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeDDL(i);
                  }}
                  aria-label={`删除 DDL ${i + 1}`}
                  title="删除这个 DDL"
                >
                  ×
                </button>
              </div>
              <div className="create-task-form">
                <label><span>标题</span><input value={ddl.title} onChange={(e) => updateDDL(i, 'title', e.target.value)} /></label>
                <label><span>截止时间</span><input type="datetime-local" value={dayjs(ddl.deadline).format('YYYY-MM-DDTHH:mm')} onChange={(e) => updateDDL(i, 'deadline', new Date(e.target.value).toISOString())} /></label>
                <label><span>优先级</span><select value={ddl.priority} onChange={(e) => updateDDL(i, 'priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
                <label><span>地点/位置</span><input value={ddl.location || ''} onChange={(e) => updateDDL(i, 'location', e.target.value)} placeholder="教室、会议室、线上会议等" /></label>
                <label className="wide"><span>描述</span><textarea value={ddl.description} onChange={(e) => updateDDL(i, 'description', e.target.value)} rows={3} /></label>
                <label className="wide"><span>原通知</span><textarea value={ddl.originalText || result.originalText} onChange={(e) => updateDDL(i, 'originalText', e.target.value)} rows={5} /></label>
              </div>
            </section>
          ))}
        </div>

        <footer className="create-task-actions">
          <button type="button" className="secondary" onClick={onCancel}>取消</button>
          <button type="button" className="primary" onClick={handleCreate} disabled={creating || ddls.length === 0}>
            {creating ? '保存中...' : '确认创建'}
          </button>
        </footer>
      </motion.section>
    </motion.div>
  );

  return createPortal(modal, document.body);
}
