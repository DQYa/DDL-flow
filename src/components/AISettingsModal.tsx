import { useState } from 'react';
import { motion } from 'framer-motion';
import { loadAIConfig, saveAIConfig } from '../utils/api';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AISettingsModal({ onClose, onSaved }: Props) {
  const [config, setConfig] = useState(() => loadAIConfig());
  const configured = Boolean(config.baseUrl.trim() && config.apiKey.trim());

  const updateField = (field: keyof typeof config, value: string) => {
    setConfig((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    saveAIConfig(config);
    onSaved();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.28)] backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.section
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="ai-settings-modal ui-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ai-settings-header">
          <div>
            <h2>AI 配置</h2>
            <p>支持 OpenAI Compatible API，如 OpenAI、DeepSeek、OpenRouter。</p>
          </div>
          <span className={`ai-status-pill ${configured ? 'is-connected' : 'is-missing'}`}>
            <span />
            {configured ? 'AI 已连接' : 'AI 未配置'}
          </span>
        </div>

        <div className="ai-secure-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>您的 API Key 仅保存在当前浏览器本地，不会上传、不会同步、不会保存到服务器。</span>
        </div>

        <div className="ai-settings-fields">
          <label>
            <span>API Base URL</span>
            <input
              className="ui-field"
              value={config.baseUrl}
              onChange={(event) => updateField('baseUrl', event.target.value)}
              placeholder="https://api.deepseek.com 或 https://api.openai.com/v1"
            />
          </label>
          <label>
            <span>API Key</span>
            <input
              className="ui-field"
              type="password"
              value={config.apiKey}
              onChange={(event) => updateField('apiKey', event.target.value)}
              placeholder="sk-..."
            />
          </label>
          <label>
            <span>Model Name</span>
            <input
              className="ui-field"
              value={config.model}
              onChange={(event) => updateField('model', event.target.value)}
              placeholder="deepseek-chat / gpt-4o-mini / openrouter model"
            />
          </label>
        </div>

        <div className="ai-settings-actions">
          <button type="button" className="ghost" onClick={onClose}>取消</button>
          <button type="button" onClick={handleSave}>保存配置</button>
        </div>
      </motion.section>
    </motion.div>
  );
}
