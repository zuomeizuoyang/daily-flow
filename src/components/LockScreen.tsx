import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';

interface LockScreenProps {
  onUnlock: (password: string, remember: boolean) => void;
  error?: string;
}

export function LockScreen({ onUnlock, error }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [localErr, setLocalErr] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setLocalErr('请输入访问密码');
      return;
    }
    setLocalErr('');
    onUnlock(password.trim(), remember);
  };

  return (
    <div className="lock-overlay">
      <div className="lock-card">
        <div className="lock-icon-wrap">
          <Lock size={32} strokeWidth={2} />
        </div>
        <h2>Daily Flow</h2>
        <p className="lock-subtitle">私人隐私清单 · 请输入访问密码</p>

        <form onSubmit={handleSubmit} className="lock-form">
          <div className="lock-input-group">
            <KeyRound size={17} className="lock-input-icon" />
            <input
              type="password"
              autoFocus
              placeholder="请输入你的专属访问密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalErr('');
              }}
            />
          </div>

          <label className="lock-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>在此设备记住密码（日常免密使用）</span>
          </label>

          {(localErr || error) && (
            <div className="lock-error">{localErr || error}</div>
          )}

          <button type="submit" className="lock-submit">
            <span>解锁进入</span>
            <ArrowRight size={17} />
          </button>
        </form>

        <div className="lock-footer-hint">
          <ShieldCheck size={14} />
          <span>手机与电脑输入相同密码即可自动实时同步</span>
        </div>
      </div>
    </div>
  );
}
