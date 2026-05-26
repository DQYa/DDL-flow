import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Priority, DDL } from '../types';
import { updateDDL } from '../utils/storage';
import dayjs from 'dayjs';

interface Props {
  ddl: DDL;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

const PRIORITIES: Priority[] = ['高', '中', '低'];

export default function EditModal({ ddl, onConfirm, onCancel, onDelete }: Props) {
  const [title, setTitle] = useState(ddl.title);
  const [deadline, setDeadline] = useState(dayjs(ddl.deadline).format('YYYY-MM-DDTHH:mm'));
  const [priority, setPriority] = useState<Priority>(ddl.priority);
  const [description, setDescription] = useState(ddl.description || '');

  const handleSave = async () => {
    if (!title.trim()) return;
    await updateDDL({
      ...ddl,
      title: title.trim(),
      deadline: new Date(deadline).toISOString(),
      priority,
      description,
    });
    onConfirm();
  };

  const handleDelete = () => {
    const ok = window.confirm(`确定删除任务「${ddl.title || '未命名任务'}」吗？此操作不可撤销。`);
    if (!ok) return;
    onDelete(ddl.id);
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
        style={{ width: 720, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="p-7">
          <h3 className="text-[22px] font-semibold text-[var(--color-text)] mb-6">编辑任务</h3>

          {/* Title */}
          <div className="mb-5">
            <label className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-2 block">任务标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 ui-field text-[15px] text-[var(--color-text)] outline-none"
            />
          </div>

          {/* Deadline */}
          <div className="mb-5">
            <label className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-2 block">截止时间</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 ui-field text-[15px] text-[var(--color-text)] outline-none cursor-pointer"
            />
          </div>

          {/* Priority */}
          <div className="mb-5">
            <label className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-2 block">优先级</label>
            <div className="flex gap-3">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-4 py-2 text-[14px] font-medium ui-chip transition-all duration-200 ${
                    priority === p
                      ? 'ui-chip-selected bg-[var(--color-primary)] text-white'
                      : 'bg-[#F1F5FA] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-light)]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-7">
            <label className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-2 block">备注说明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="可选…"
              className="w-full px-4 py-3 ui-field text-[14px] text-[var(--color-text-secondary)]
                outline-none transition-all resize-none"
              style={{ fontFamily: 'inherit' }}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleDelete}
              className="px-5 py-3 text-[14px] font-medium rounded-[7px] text-[var(--color-red)]/75
                hover:text-[var(--color-red)] hover:bg-[var(--color-red)]/5 transition-colors"
            >
              删除任务
            </button>
            <div className="flex-1 flex gap-4">
              <button
                onClick={onCancel}
                className="flex-1 py-3 text-[15px] font-medium rounded-[7px] bg-[#F1F5FA]
                  text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                className="flex-1 py-3 text-[15px] font-semibold rounded-[7px] bg-[var(--color-primary)]
                  text-white hover:bg-[var(--color-primary-dark)] transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
