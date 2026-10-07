'use client';

// Settings: /settings
// "Bring your own key" for Speaking AI scoring. The key is stored ONLY in
// this browser's localStorage and is sent to /api/speaking/score with each
// scoring request — the server never stores or logs it.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  TrashIcon,
  ShieldCheckIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import {
  clearAiSettings,
  getAiSettings,
  saveAiSettings,
  type AiProvider,
} from '@/lib/aiKey';

export default function SettingsPage() {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [savedProvider, setSavedProvider] = useState<AiProvider | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const s = getAiSettings();
    setProvider(s.provider);
    setSavedProvider(s.apiKey ? s.provider : null);
  }, []);

  function handleSave() {
    const k = key.trim();
    if (!k) {
      setToast('Nhập API key trước khi lưu nhé.');
      return;
    }
    saveAiSettings(provider, k);
    setSavedProvider(provider);
    setKey('');
    setShow(false);
    setToast('Đã lưu key. Key chỉ nằm trong trình duyệt này.');
  }

  function handleClear() {
    clearAiSettings();
    setSavedProvider(null);
    setKey('');
    setToast('Đã xóa key khỏi trình duyệt.');
  }

  const providers: { id: AiProvider; name: string; badge: string; logo: string; desc: React.ReactNode }[] = [
    {
      id: 'gemini',
      name: 'Gemini',
      badge: 'KHUYÊN DÙNG · MIỄN PHÍ',
      logo: '/logos/gemini.svg',
      desc: (
        <>
          Lấy key miễn phí tại{' '}
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            aistudio.google.com
            <ArrowTopRightOnSquareIcon width={12} height={12} />
          </a>{' '}
          (Get API key)
        </>
      ),
    },
    {
      id: 'openai',
      name: 'OpenAI',
      badge: '',
      logo: '/logos/openai.svg',
      desc: (
        <>
          Trả phí theo lượt dùng — lấy key tại{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            platform.openai.com/api-keys
            <ArrowTopRightOnSquareIcon width={12} height={12} />
          </a>
        </>
      ),
    },
  ];

  return (
    <main className="page-med">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <h1 className="brand" style={{ fontSize: '2.2rem' }}>
        Cài đặt <span className="hl">AI</span>
      </h1>
      <p className="lead">
        Thêm API key của <strong>chính bạn</strong> để AI chấm bài Speaking. Mỗi người
        dùng key riêng — không phụ thuộc vào key của server.
      </p>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="field">
          <label>Nhà cung cấp AI</label>
          <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
            {providers.map((p) => (
              <label
                key={p.id}
                className={`opt-card${provider === p.id ? ' selected' : ''}`}
                style={{ cursor: 'pointer', margin: 0, alignItems: 'flex-start' }}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={provider === p.id}
                  onChange={() => setProvider(p.id)}
                  style={{ marginTop: 5, accentColor: 'var(--accent)' }}
                />
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src={p.logo}
                      alt={`${p.name} logo`}
                      width={20}
                      height={20}
                      style={{ borderRadius: 5, background: '#fff', padding: 2 }}
                    />
                    {p.name}
                  </strong>{' '}
                  {p.badge && <span className="chip">{p.badge}</span>}
                  <br />
                  <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{p.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="aikey" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <KeyIcon width={15} height={15} />
            API key
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="aikey"
              className="input"
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={provider === 'gemini' ? 'AIza…' : 'sk-…'}
              autoComplete="off"
              spellCheck={false}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="icon-btn"
              style={{ width: 46, height: 46 }}
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Ẩn key' : 'Hiện key'}
              title={show ? 'Ẩn key' : 'Hiện key'}
            >
              {show ? <EyeSlashIcon width={19} height={19} /> : <EyeIcon width={19} height={19} />}
            </button>
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={handleSave}>
            <CheckIcon width={16} height={16} />
            Lưu key
          </button>
          {savedProvider && (
            <button className="btn" onClick={handleClear}>
              <TrashIcon width={16} height={16} />
              Xóa key
            </button>
          )}
        </div>

        {toast && (
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 12 }}>{toast}</p>
        )}
      </div>

      <div className="card-soft" style={{ marginTop: 16 }}>
        <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: 1.7, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <ShieldCheckIcon width={20} height={20} style={{ flexShrink: 0, color: 'var(--muted)', marginTop: 2 }} />
          <span>
            <strong>Trạng thái:</strong>{' '}
            {savedProvider ? (
              <span>
                Đã lưu key {savedProvider === 'gemini' ? 'Gemini' : 'OpenAI'} trong trình
                duyệt này. Quay lại{' '}
                <Link href="/speaking">Luyện Speaking</Link> để chấm bài.
              </span>
            ) : (
              <span>
                Chưa có key. Key của bạn <strong>chỉ được lưu trong trình duyệt này</strong>{' '}
                (localStorage) và chỉ được gửi thẳng tới{' '}
                {provider === 'gemini' ? 'Google' : 'OpenAI'} khi chấm bài — server không
                lưu hay ghi log key của bạn.
              </span>
            )}
          </span>
        </p>
      </div>
    </main>
  );
}
