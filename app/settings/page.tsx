'use client';

// Settings: /settings
// "Bring your own key" for AI scoring (Speaking + Writing). The key is stored
// ONLY in this browser's localStorage and is sent to the scoring APIs with
// each request — the server never stores or logs it.

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
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  clearAiSettings,
  getAiSettings,
  saveAiSettings,
  type AiProvider,
} from '@/lib/aiKey';

type TestState = 'idle' | 'testing' | 'ok' | 'bad';

function maskKey(k: string): string {
  const t = k.trim();
  if (t.length <= 10) return '••••••••';
  return `${t.slice(0, 4)}••••••••${t.slice(-4)}`;
}

const PROVIDERS: {
  id: AiProvider;
  name: string;
  badge: string;
  logo: string;
  keyUrl: string;
  keyLabel: string;
  placeholder: string;
}[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    badge: 'KHUYÊN DÙNG · MIỄN PHÍ',
    logo: '/logos/gemini.svg',
    keyUrl: 'https://aistudio.google.com',
    keyLabel: 'aistudio.google.com → Get API key',
    placeholder: 'AIza…',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    badge: 'TRẢ PHÍ',
    logo: '/logos/openai.svg',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'platform.openai.com/api-keys',
    placeholder: 'sk-…',
  },
];

export default function SettingsPage() {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [hasKey, setHasKey] = useState(false);
  const [savedKey, setSavedKey] = useState('');
  const [savedProvider, setSavedProvider] = useState<AiProvider>('gemini');
  const [editing, setEditing] = useState(true);
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [toast, setToast] = useState('');

  // Load from localStorage after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    const s = getAiSettings();
    setProvider(s.provider);
    setSavedProvider(s.provider);
    setSavedKey(s.apiKey);
    setHasKey(!!s.apiKey);
    setEditing(!s.apiKey);
  }, []);

  const meta = PROVIDERS.find((p) => p.id === (hasKey ? savedProvider : provider))!;

  async function testKey(k: string, p: AiProvider): Promise<boolean> {
    setTestState('testing');
    setTestMsg('');
    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p, apiKey: k }),
      });
      const data = await res.json().catch(() => null);
      if (data?.valid) {
        setTestState('ok');
        setTestMsg('Key hợp lệ — dùng được ngay.');
        return true;
      }
      setTestState('bad');
      setTestMsg(data?.error || 'Key không dùng được.');
      return false;
    } catch {
      setTestState('bad');
      setTestMsg('Không kết nối được. Thử lại sau.');
      return false;
    }
  }

  function handleSave() {
    const k = key.trim();
    if (!k) {
      setToast('Nhập API key trước khi lưu nhé.');
      return;
    }
    saveAiSettings(provider, k);
    setHasKey(true);
    setSavedKey(k);
    setSavedProvider(provider);
    setEditing(false);
    setKey('');
    setShow(false);
    setTestState('idle');
    setTestMsg('');
    setToast('Đã lưu key. Key chỉ nằm trong trình duyệt này.');
  }

  function handleClear() {
    clearAiSettings();
    setHasKey(false);
    setSavedKey('');
    setEditing(true);
    setKey('');
    setTestState('idle');
    setTestMsg('');
    setToast('Đã xóa key khỏi trình duyệt.');
  }

  return (
    <main className="page-med">
      <div className="nav-top">
        <Link href="/" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Trang chủ
        </Link>
      </div>
      <p className="page-eyebrow">07 — Cài đặt</p>
      <h1 className="page-title">Cài đặt AI</h1>
      <p className="page-sub">
        Thêm API key của <strong>chính bạn</strong> để dùng AI chấm bài{' '}
        <Link href="/speaking">Speaking</Link> và <Link href="/writing">Writing</Link>.
        Mỗi người dùng key riêng.
      </p>

      <div className="card" style={{ marginTop: 20 }}>
        {hasKey && !editing ? (
          /* ---------- Saved state ---------- */
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <img
                src={meta.logo}
                alt={`${meta.name} logo`}
                width={32}
                height={32}
                style={{ borderRadius: 8, background: '#fff', padding: 4 }}
              />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{meta.name}</strong>
                  <span className="chip ok">ĐANG DÙNG</span>
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: 'var(--muted)',
                    marginTop: 2,
                  }}
                >
                  {maskKey(savedKey)}
                </div>
              </div>
            </div>

            {(testState === 'ok' || testState === 'bad' || testState === 'testing') && (
              <p
                style={{
                  fontSize: '0.88rem',
                  margin: '12px 0 0',
                  color:
                    testState === 'ok'
                      ? 'var(--correct)'
                      : testState === 'bad'
                        ? 'var(--wrong)'
                        : 'var(--muted)',
                }}
              >
                {testState === 'testing' ? 'Đang kiểm tra key…' : testMsg}
              </p>
            )}

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button
                className="btn"
                onClick={() => testKey(savedKey, savedProvider)}
                disabled={testState === 'testing'}
              >
                <CheckIcon width={16} height={16} />
                Kiểm tra lại
              </button>
              <button className="btn" onClick={() => { setEditing(true); setProvider(savedProvider); setTestState('idle'); setTestMsg(''); }}>
                <ArrowPathIcon width={16} height={16} />
                Đổi key
              </button>
              <button className="btn" onClick={handleClear}>
                <TrashIcon width={16} height={16} />
                Xóa key
              </button>
            </div>
          </>
        ) : (
          /* ---------- Setup form ---------- */
          <>
            <div className="field">
              <label>Nhà cung cấp AI</label>
              <div className="seg-tabs" style={{ marginTop: 6 }} role="tablist" aria-label="Nhà cung cấp AI">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={provider === p.id}
                    onClick={() => { setProvider(p.id); setTestState('idle'); setTestMsg(''); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <img
                      src={p.logo}
                      alt={`${p.name} logo`}
                      width={18}
                      height={18}
                      style={{ borderRadius: 4, background: '#fff', padding: 2 }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '8px 0 0' }}>
                {PROVIDERS.find((p) => p.id === provider)!.badge}
                {' · Lấy key miễn phí tại '}
                <a href={PROVIDERS.find((p) => p.id === provider)!.keyUrl} target="_blank" rel="noreferrer">
                  {PROVIDERS.find((p) => p.id === provider)!.keyLabel}
                  <ArrowTopRightOnSquareIcon width={12} height={12} style={{ verticalAlign: -1 }} />
                </a>
              </p>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
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
                  onChange={(e) => { setKey(e.target.value); setTestState('idle'); setTestMsg(''); }}
                  placeholder={PROVIDERS.find((p) => p.id === provider)!.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  style={{ flex: 1, fontFamily: 'monospace' }}
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

            {(testState === 'ok' || testState === 'bad' || testState === 'testing') && (
              <p
                style={{
                  fontSize: '0.88rem',
                  margin: '10px 0 0',
                  color:
                    testState === 'ok'
                      ? 'var(--correct)'
                      : testState === 'bad'
                        ? 'var(--wrong)'
                        : 'var(--muted)',
                }}
              >
                {testState === 'testing' ? 'Đang kiểm tra key…' : testMsg}
              </p>
            )}

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn primary" onClick={handleSave}>
                <CheckIcon width={16} height={16} />
                Lưu key
              </button>
              <button
                className="btn"
                onClick={() => testKey(key.trim(), provider)}
                disabled={testState === 'testing' || !key.trim()}
              >
                Kiểm tra key
              </button>
              {hasKey && (
                <button className="btn" onClick={() => { setEditing(false); setKey(''); setTestState('idle'); setTestMsg(''); }}>
                  Hủy
                </button>
              )}
            </div>
          </>
        )}

        {toast && (
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 12 }}>{toast}</p>
        )}
      </div>

      <div className="card-soft" style={{ marginTop: 16 }}>
        <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: 1.7, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <ShieldCheckIcon width={20} height={20} style={{ flexShrink: 0, color: 'var(--muted)', marginTop: 2 }} />
          <span>
            Key của bạn <strong>chỉ được lưu trong trình duyệt này</strong> và chỉ được
            gửi thẳng tới {hasKey ? (savedProvider === 'gemini' ? 'Google' : 'OpenAI') : 'nhà cung cấp'} khi chấm bài —
            server không lưu hay ghi log key của bạn. Đổi trình duyệt thì cần nhập lại key.
          </span>
        </p>
      </div>
    </main>
  );
}
