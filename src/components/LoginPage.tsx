import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim() && password.length >= 6 && !loading;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!canSubmit) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
    } else if (!data.session) {
      setNotice('注册成功，请根据邮箱提示完成验证后再登录。');
    }
    setLoading(false);
  };

  return (
    <div className="auth-shell">
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        className="auth-card ui-panel"
      >
        <div className="auth-mark">D</div>
        <h1>DDL Flow</h1>
        <p className="auth-subtitle">登录后，每个账号只会看到自己的 DDL 和项目。</p>

        <div className="auth-fields">
          <label>
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="ui-field"
              placeholder="you@example.com"
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleLogin();
              }}
              className="ui-field"
              placeholder="至少 6 位"
            />
          </label>
        </div>

        {error && <div className="auth-message auth-error">{error}</div>}
        {notice && <div className="auth-message auth-notice">{notice}</div>}

        <div className="auth-actions">
          <button type="button" onClick={handleLogin} disabled={!canSubmit}>
            {loading ? '处理中...' : '登录'}
          </button>
          <button type="button" onClick={handleRegister} disabled={!canSubmit} className="secondary">
            注册
          </button>
        </div>
      </motion.section>
    </div>
  );
}
