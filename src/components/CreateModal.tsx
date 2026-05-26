import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Category, Priority, ParsedResult, ParsedDDL } from '../types';
import { createProjectWithDDLs, loadCategories, saveCategories } from '../utils/storage';
import dayjs from 'dayjs';

interface Props {
  result: ParsedResult;
  onConfirm: () => void;
  onCancel: () => void;
}

function id(): string {
  return crypto.randomUUID();
}

const PRIORITIES: Priority[] = ['高', '中', '低'];

export default function CreateModal({ result, onConfirm, onCancel }: Props) {
  const [projectName, setProjectName] = useState(result.projectName);
  const [category, setCategory] = useState<Category>(result.category);
  const [ddls, setDdls] = useState<ParsedDDL[]>(result.ddls);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories().then(setCategories);
  }, []);

  const updateDDL = (index: number, field: keyof ParsedDDL, value: string) => {
    setDdls((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const handleAddCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
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
        name: projectName,
        category,
        originalText: result.originalText,
        createdAt: now,
      };

      const newDDLs = ddls.map((d) => ({
        id: id(),
        projectId,
        title: d.title,
        description: d.description,
        deadline: typeof d.deadline === 'string' ? d.deadline : dayjs(d.deadline).toISOString(),
        priority: d.priority,
        category,
        completed: false,
        createdAt: now,
      }));

      await createProjectWithDDLs(newProject, newDDLs);
      onConfirm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('CreateModal handleCreate:', msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.28)] backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[8px] shadow-[var(--shadow-panel)] border border-[var(--color-border)]"
        style={{ width: 880, maxHeight: '88vh', overflowY: 'auto' }}
      >
        <div className="p-7">
          <h3 className="text-[22px] font-semibold text-[var(--color-text)] mb-6">确认创建任务</h3>

          {/* Project name */}
          <div className="mb-5">
            <label className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 block">项目名称</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-4 py-3 ui-field text-[16px] text-[var(--color-text)] outline-none"
            />
          </div>

          {/* Category */}
          <div className="mb-5">
            <label className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 block">分类</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div key={c} className="relative group">
                  <button
                    onClick={() => setCategory(c)}
                    className={`px-3 py-2 text-[13px] font-medium ui-chip transition-all duration-200 ${
                      category === c
                        ? 'ui-chip-selected bg-[var(--color-primary)] text-white'
                        : 'bg-[#F1F5FA] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-light)]'
                    }`}
                  >
                    {c}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveCategory(c); }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-red)] text-white rounded-full
                      text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                </div>
              ))}
              {/* Add category */}
              <div className="flex gap-0">
                <input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                  placeholder="新"
                  className="w-[46px] px-2 py-2 bg-[#F1F5FA] text-[13px] rounded-l-[7px] text-[var(--color-text)]
                    outline-none border border-transparent focus:border-[var(--color-primary)]/30"
                />
                <button
                  onClick={handleAddCategory}
                  className="w-[28px] py-2 bg-[var(--color-primary)] text-white text-[15px] font-medium rounded-r-[7px]
                    hover:bg-[var(--color-primary-dark)] transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* DDLs */}
          <div className="mb-6">
            <label className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 block">
              DDL 列表 ({ddls.length}个)
            </label>
            <div className="space-y-3">
              {ddls.map((ddl, i) => (
                <div key={i} className="bg-[#F8FAFD] border border-[var(--color-border)] rounded-[8px] p-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={ddl.title}
                      onChange={(e) => updateDDL(i, 'title', e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-white text-[14px] text-[var(--color-text)] rounded-[7px]
                        outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all border border-transparent focus:border-[var(--color-primary)]/30"
                      placeholder="DDL 标题"
                    />
                    <select
                      value={ddl.priority}
                      onChange={(e) => updateDDL(i, 'priority', e.target.value as Priority)}
                      className="px-3 py-2.5 bg-white text-[14px] text-[var(--color-text)] outline-none border border-transparent rounded-[7px]"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="datetime-local"
                    value={dayjs(ddl.deadline).format('YYYY-MM-DDTHH:mm')}
                    onChange={(e) => updateDDL(i, 'deadline', new Date(e.target.value).toISOString())}
                    className="w-full px-3 py-3 bg-white text-[15px] text-[var(--color-text)] rounded-[7px] outline-none cursor-pointer"
                  />
                  <input
                    value={ddl.description}
                    onChange={(e) => updateDDL(i, 'description', e.target.value)}
                    className="w-full px-3 py-2.5 bg-white text-[14px] text-[var(--color-text-secondary)] rounded-[7px]
                      outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
                    placeholder="说明"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Original text */}
          <div className="mb-6">
            <label className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 block">原始内容</label>
            <div className="bg-[#F8FAFD] rounded-[8px] p-4 text-[13px] text-[var(--color-text-secondary)]
              whitespace-pre-wrap leading-relaxed max-h-[128px] overflow-y-auto border border-[var(--color-border)]">
              {result.originalText}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-[7px] text-[13px] text-red-700">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 text-[15px] font-medium rounded-[7px] bg-[#F1F5FA]
                text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 py-3 text-[15px] font-semibold rounded-[7px] bg-[var(--color-primary)]
                text-white hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? '保存中...' : '确认创建'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
