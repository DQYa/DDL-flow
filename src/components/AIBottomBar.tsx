import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Priority, ParsedResult } from '../types';
import { getAIStatus, parseWithAI } from '../utils/api';
import CreateModal from './CreateModal';
import AISettingsModal from './AISettingsModal';

interface Props {
  userName: string;
  onCreated: () => void;
}

const PRIORITY_OPTIONS = [
  { key: 'auto' as const, label: '自动' },
  { key: '低' as Priority, label: '低' },
  { key: '中' as Priority, label: '中' },
  { key: '高' as Priority, label: '高' },
];

export default function AIBottomBar({ userName, onCreated }: Props) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority | 'auto'>('auto');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiConfigured, setAIConfigured] = useState(() => getAIStatus().configured);

  const refreshAIStatus = () => {
    setAIConfigured(getAIStatus().configured);
  };

  useEffect(() => {
    const handleUpdate = () => refreshAIStatus();
    window.addEventListener('ddlflow-ai-config-updated', handleUpdate);
    return () => window.removeEventListener('ddlflow-ai-config-updated', handleUpdate);
  }, []);

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const parsed = await parseWithAI(text, userName);
      if (priority !== 'auto') {
        parsed.ddls = parsed.ddls.map((d) => ({ ...d, priority }));
      }
      setResult(parsed);
      setShowModal(true);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = () => {
    setText('');
    setResult(null);
    setShowModal(false);
    onCreated();
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        className="ui-panel p-3 h-full flex flex-col"
      >
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          <span className={`ai-icon-wrap ${aiConfigured ? 'is-configured' : 'is-missing'}`} title={aiConfigured ? 'AI 已配置' : 'AI 未配置'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
            {!aiConfigured && <span className="ai-warning-dot" />}
          </span>
          <span className="text-[15px] font-semibold text-[var(--color-text)]">AI 任务解析</span>
        </div>

        {!aiConfigured && (
          <div className="ai-fallback-warning">
            未配置 AI API，当前使用简易识别模式，识别结果可能不准确，请谨慎使用。
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleParse();
            }
          }}
          placeholder={'粘贴通知/作业/群聊...\nCtrl+Enter 解析'}
          className="flex-1 w-full min-h-0 ui-field resize-none text-[12px] text-[var(--color-text)]
            placeholder:text-[var(--color-text-muted)] outline-none p-3 leading-relaxed"
          style={{ fontFamily: 'inherit' }}
        />

        <div className="flex items-center gap-1.5 mt-2 shrink-0">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPriority(opt.key)}
              className={`px-2.5 py-1.5 ui-chip text-[12px] font-medium transition-all duration-200 ${
                priority === opt.key
                  ? 'ui-chip-selected bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-[#F1F5FA] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-light)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleParse}
            disabled={!text.trim() || parsing}
            className="ml-auto px-3.5 py-1.5 bg-[var(--color-primary)] text-white rounded-[7px] text-[13px] font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-primary-dark)] transition-colors
              flex items-center gap-1 shrink-0"
          >
            {parsing ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI 解析中
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="9 10 4 15 9 20" />
                  <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                </svg>
                解析
              </>
            )}
          </motion.button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className={`ai-api-button ${aiConfigured ? 'is-configured' : 'is-missing'}`}
          >
            API
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && result && (
          <CreateModal result={result} onConfirm={handleConfirm} onCancel={() => setShowModal(false)} />
        )}
        {showSettings && (
          <AISettingsModal
            onClose={() => setShowSettings(false)}
            onSaved={refreshAIStatus}
          />
        )}
      </AnimatePresence>
    </>
  );
}
