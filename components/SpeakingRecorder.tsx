'use client';

// Shared speaking recorder: records one part with MediaRecorder, uploads to
// /api/speaking/score, and shows per-part AI scores against the 5 official
// VSTEP criteria. Used by /speaking (free practice) and /speaking/de-thi/[id].

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import {
  ArrowPathIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  MicrophoneIcon,
  SparklesIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { getAiSettings } from '@/lib/aiKey';
import { SPEAKING_CRITERIA } from '@/lib/speaking';

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

interface ScoreResult {
  transcript: string;
  scores: Record<string, number>;
  overall: number;
  feedback_vi: string;
}

type Phase = 'idle' | 'prep' | 'ready' | 'recording' | 'uploading' | 'done';

// --- recorder + scorer for one part ------------------------------------------

export function RecorderPanel({
  part,
  promptText,
  prepSec,
  talkSec,
  prepLabel,
  serverKey,
}: {
  part: number;
  promptText: string;
  prepSec: number;
  talkSec: number;
  prepLabel: string;
  /** null = still checking, true/false = server has its own OpenAI key or not */
  serverKey: boolean | null;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [prepLeft, setPrepLeft] = useState(prepSec);
  const [talkLeft, setTalkLeft] = useState(talkSec);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState('');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        try {
          mediaRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  function startPrep() {
    setError('');
    setResult(null);
    stoppingRef.current = false;
    if (prepSec <= 0) {
      setPhase('ready');
    } else {
      setPrepLeft(prepSec);
      setPhase('prep');
    }
  }

  useEffect(() => {
    if (phase !== 'prep') return;
    if (prepLeft <= 0) {
      setPhase('ready');
      return;
    }
    const id = setTimeout(() => setPrepLeft((p) => p - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, prepLeft]);

  async function startRecording() {
    setError('');
    stoppingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void handleStopped();
      };
      mediaRef.current = rec;
      rec.start(500);
      setTalkLeft(talkSec);
      setPhase('recording');
    } catch {
      setError('Không truy cập được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại.');
    }
  }

  useEffect(() => {
    if (phase !== 'recording') return;
    if (talkLeft <= 0) {
      stopRecording();
      return;
    }
    const id = setTimeout(() => setTalkLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, talkLeft]);

  function stopRecording() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const rec = mediaRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop(); // -> onstop -> handleStopped
    } else {
      void handleStopped();
    }
  }

  async function handleStopped() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size === 0) {
      setError('Bản ghi âm trống. Hãy thử ghi âm lại.');
      setPhase('ready');
      stoppingRef.current = false;
      return;
    }
    setPhase('uploading');
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');
    fd.append('part', String(part));
    fd.append('prompt', promptText);
    // BYOK: attach the user's own provider + key when saved. When absent, the
    // server falls back to its own OPENAI_API_KEY (if configured).
    const ai = getAiSettings();
    const canScore = !!ai.apiKey || serverKey === true;
    if (!canScore) {
      setError(
        'Cần API key để AI chấm điểm. Vào trang Cài đặt để thêm key OpenAI hoặc Gemini của bạn nhé!'
      );
      setPhase('ready');
      stoppingRef.current = false;
      return;
    }
    if (ai.apiKey) {
      fd.append('provider', ai.provider);
      fd.append('apiKey', ai.apiKey);
    }
    try {
      const res = await fetch('/api/speaking/score', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chấm bài thất bại.');
      setResult(data as ScoreResult);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chấm bài thất bại. Hãy thử lại.');
      setPhase('ready');
    }
    stoppingRef.current = false;
  }

  const ai = getAiSettings();
  const noKeyConfigured = serverKey === false && !ai.apiKey;

  return (
    <div style={{ marginTop: 18 }}>
      {noKeyConfigured && (
        <div className="card-soft" style={{ marginBottom: 14, border: '1.5px dashed var(--accent)' }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.92rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <KeyIcon width={20} height={20} style={{ flexShrink: 0, color: 'var(--accent-strong)', marginTop: 2 }} />
            <span>
              <strong>Thêm API key để dùng AI chấm điểm.</strong>
              <br />
              <span style={{ color: 'var(--muted)' }}>
                Mỗi người dùng key riêng của mình (Gemini miễn phí) — key chỉ lưu trong
                trình duyệt của bạn.
              </span>
            </span>
          </p>
          <Link href="/settings" className="btn primary" style={{ textDecoration: 'none' }}>
            <KeyIcon width={16} height={16} />
            Mở Cài đặt AI
          </Link>
        </div>
      )}
      {phase === 'idle' && (
        <button className="btn primary" onClick={startPrep}>
          <MicrophoneIcon width={17} height={17} />
          {prepSec > 0 ? `Bắt đầu chuẩn bị (${prepLabel})` : 'Bắt đầu ghi âm'}
        </button>
      )}
      {phase === 'prep' && (
        <div className="card-soft" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <ClockIcon width={16} height={16} />
            Thời gian chuẩn bị
          </div>
          <div style={{ fontSize: '2.6rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(prepLeft)}</div>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '8px 0 0' }}>
            Đọc kỹ đề và gạch ý ra nháp. Hết giờ sẽ chuyển sang ghi âm.
          </p>
        </div>
      )}
      {phase === 'ready' && (
        <div className="btn-row">
          <button className="btn primary" onClick={startRecording}>
            <span className="rec-dot" />
            Bắt đầu nói (tối đa {fmt(talkSec)})
          </button>
          <button className="btn" onClick={startPrep}>
            <ArrowPathIcon width={16} height={16} />
            Chuẩn bị lại
          </button>
        </div>
      )}
      {phase === 'recording' && (
        <div className="card-soft" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
            <span className="rec-dot" /> Đang ghi âm
          </div>
          <div style={{ fontSize: '2.6rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(talkLeft)}</div>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 10 }}>
            <button className="btn primary" onClick={stopRecording}>
              <StopIcon width={16} height={16} />
              Dừng & chấm điểm
            </button>
          </div>
        </div>
      )}
      {phase === 'uploading' && (
        <p style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <SparklesIcon width={18} height={18} style={{ color: 'var(--accent-strong)' }} />
          AI đang nghe và chấm bài của bạn, chờ một chút…
        </p>
      )}
      {error && (
        <p style={{ color: 'var(--wrong)', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <ExclamationTriangleIcon width={18} height={18} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </p>
      )}
      {phase === 'done' && result && (
        <>
          <ScoreCard result={result} />
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={startPrep}>
              <ArrowPathIcon width={16} height={16} />
              Ghi âm lại
            </button>
            <Link href="/progress" className="btn" style={{ textDecoration: 'none' }}>
              <ChartBarIcon width={16} height={16} />
              Xem tiến bộ
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function ScoreCard({ result }: { result: ScoreResult }) {
  return (
    <div className="card-soft">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="icon-badge">
          <CheckCircleIcon width={24} height={24} />
        </span>
        <div>
          <strong style={{ fontSize: '2rem', fontWeight: 800 }}>
            {result.overall.toFixed(1)}
          </strong>
          <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>/ 10 · điểm tổng</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {SPEAKING_CRITERIA.map((c) => {
          const v = result.scores?.[c.key] ?? 0;
          return (
            <div key={c.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', gap: 8 }}>
                <span>
                  <strong>{c.label}</strong>{' '}
                  <span style={{ color: 'var(--muted)' }}>· {c.vi}</span>
                </span>
                <strong>{v.toFixed(1)}</strong>
              </div>
              <div className="score-bar" style={{ marginTop: 5 }}>
                <div style={{ width: `${v * 10}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--faint)', marginTop: 12 }}>
        Lưu ý: điểm Phát âm của AI chỉ mang tính tương đối vì AI không nghe trực tiếp
        như giám khảo người.
      </p>
      <details style={{ marginTop: 10 }} open>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem' }}>
          Nhận xét chi tiết
        </summary>
        <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.7 }}>{result.feedback_vi}</p>
      </details>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem' }}>
          Bản ghi lời nói (transcript)
        </summary>
        <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--muted)' }}>{result.transcript}</p>
      </details>
    </div>
  );
}

export function AuthedRecorder(props: {
  part: number;
  promptText: string;
  prepSec: number;
  talkSec: number;
  prepLabel: string;
}) {
  const { data: session, status } = useSession();
  // Whether the server has its own OpenAI key as a fallback (boolean only).
  const [serverKey, setServerKey] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetch('/api/speaking/config')
      .then((r) => (r.ok ? r.json() : { hasServerKey: false }))
      .then((d) => {
        if (!cancelled) setServerKey(!!d.hasServerKey);
      })
      .catch(() => {
        if (!cancelled) setServerKey(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (status === 'loading') {
    return <p style={{ color: 'var(--muted)', marginTop: 18 }}>Đang tải…</p>;
  }
  if (!session?.user) {
    return (
      <div className="card-soft" style={{ marginTop: 18, textAlign: 'center' }}>
        <p style={{ margin: '0 0 12px' }}>
          Đăng nhập bằng Google để ghi âm, chấm điểm AI và lưu kết quả.
        </p>
        <button className="btn primary" onClick={() => signIn('google')}>
          Đăng nhập bằng Google
        </button>
      </div>
    );
  }
  return <RecorderPanel {...props} serverKey={serverKey} />;
}
