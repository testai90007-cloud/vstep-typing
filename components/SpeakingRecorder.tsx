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
} from '@heroicons/react/24/outline';
import { getAiSettings } from '@/lib/aiKey';
import { SPEAKING_CRITERIA } from '@/lib/speaking';
import VoicePill from '@/components/VoicePill';
import CountUp from '@/components/CountUp';
import LatticeLoader from '@/components/LatticeLoader';
import { useIsDark } from '@/components/useIsDark';

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

interface ScoreResult {
  transcript: string;
  scores: Record<string, number>;
  overall: number;
  feedback_vi: string;
  /** false when scoring succeeded but the DB persist failed */
  persisted?: boolean;
}
export type { ScoreResult };

type Phase = 'idle' | 'prep' | 'ready' | 'recording' | 'uploading' | 'done';

// --- recorder + scorer for one part ------------------------------------------

export function RecorderPanel({
  part,
  promptText,
  prepSec,
  talkSec,
  prepLabel,
  serverKey,
  examMode = false,
  onPartFinished,
  onScoringStateChange,
  sessionMode,
}: {
  part: number;
  promptText: string;
  prepSec: number;
  talkSec: number;
  prepLabel: string;
  /** null = still checking, true/false = server has its own OpenAI key or not */
  serverKey: boolean | null;
  /**
   * Exam (mock-test) mode: auto-starts prep on mount, auto-starts recording
   * when prep ends, hides the detailed score card (the parent shows a final
   * summary instead), and calls onPartFinished once per attempt — with the
   * score on success, or null when scoring failed.
   */
  examMode?: boolean;
  onPartFinished?: (result: ScoreResult | null) => void;
  /** Fires when AI upload/scoring starts/ends so a parent timer can pause. */
  onScoringStateChange?: (scoring: boolean) => void;
  /** 'practice' | 'mock' — stored with the session for history */
  sessionMode?: string;
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
  /** slide-to-cancel on the voice pill: discard the take instead of uploading */
  const cancelledRef = useRef(false);
  /** remount the voice pill to force it back to idle (e.g. our mic request failed) */
  const [pillKey, setPillKey] = useState(0);
  /** examMode: bump to auto-begin the voice pill when recording auto-starts */
  const [autoBegin, setAutoBegin] = useState(0);
  const isDark = useIsDark();
  /** examMode: once an error happens, stop auto-advancing (avoid record loops) */
  const examBlockedRef = useRef(false);
  /** increments per startRecording call — stale pending starts are discarded */
  const startRequestRef = useRef(0);
  /** a stop arrived while getUserMedia was pending — cancel the pending start */
  const pendingCancelRef = useRef(false);
  /** object URL for the recorded take, for playback in the result view */
  const recordedUrlRef = useRef<string | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        try {
          mediaRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  // Tell the parent when AI upload/scoring is in flight so an exam timer can
  // pause — the wait for the network must not eat the exam budget.
  useEffect(() => {
    onScoringStateChange?.(phase === 'uploading');
  }, [phase, onScoringStateChange]);

  function startPrep() {
    setError('');
    setResult(null);
    stoppingRef.current = false;
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    setRecordedUrl(null);
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

  // examMode: auto-start prep as soon as the part mounts
  useEffect(() => {
    if (examMode && phase === 'idle') {
      startPrep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examMode, phase]);

  // examMode: auto-start recording when prep finishes (skip the manual step)
  useEffect(() => {
    if (!examMode || phase !== 'ready' || examBlockedRef.current) return;
    // Wait for the server-key config check before auto-starting; the key gate
    // inside startRecording would otherwise stall the exam flow.
    if (!getAiSettings().apiKey && serverKey === null) return;
    const t = setTimeout(() => {
      void startRecording().then((res) => {
        // the voice pill mounts on phase='recording'; this signal makes it
        // begin listening by itself (no imperative API on the pill)
        if (res === 'ok') setAutoBegin((k) => k + 1);
      });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examMode, phase, serverKey]);

  /**
   * 'ok' = recording started; 'fail' = mic/key/browser error (error shown);
   * 'cancelled' = a stop arrived while getUserMedia was pending, so the
   * recording never began and the pill (already idle) stays in sync.
   */
  async function startRecording(): Promise<'ok' | 'fail' | 'cancelled'> {
    setError('');
    stoppingRef.current = false;
    // Key gate BEFORE recording: never waste a take when scoring is impossible.
    const gate = getAiSettings();
    if (!gate.apiKey && serverKey === false) {
      setError(
        'Cần API key để AI chấm điểm. Vào trang Cài đặt để thêm key Gemini (miễn phí) hoặc OpenAI của bạn nhé!'
      );
      if (examMode) {
        examBlockedRef.current = true;
        onPartFinished?.(null);
      }
      return 'fail';
    }
    if (!gate.apiKey && serverKey === null) {
      // Server-key config still loading — the UI disables recording meanwhile;
      // if we somehow get here, fail without blocking the exam flow.
      return 'fail';
    }
    // Browser support check (distinct from the mic-permission error).
    if (typeof MediaRecorder === 'undefined') {
      setError('Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome, Edge hoặc Safari bản mới nhất.');
      if (examMode) {
        examBlockedRef.current = true;
        onPartFinished?.(null);
      }
      return 'fail';
    }
    const reqId = ++startRequestRef.current;
    pendingCancelRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // A stop arrived while getUserMedia was pending, or a newer start
      // superseded this one: discard the stream, recording never begins.
      if (pendingCancelRef.current || startRequestRef.current !== reqId) {
        stream.getTracks().forEach((t) => t.stop());
        setPhase('ready');
        return 'cancelled';
      }
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
      return 'ok';
    } catch {
      setError('Không truy cập được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại.');
      if (examMode) {
        examBlockedRef.current = true;
        onPartFinished?.(null);
      }
      return 'fail';
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

  /** Discard the current take (voice pill slide-to-cancel). */
  function cancelRecording() {
    cancelledRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const rec = mediaRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop(); // -> onstop -> handleStopped sees cancelledRef
    } else {
      cancelledRef.current = false;
      stoppingRef.current = false;
      chunksRef.current = [];
      setPhase('ready');
    }
  }

  /** Voice pill pressed (practice mode): start our MediaRecorder take. */
  function handlePillStart() {
    if (phase === 'recording' || phase === 'uploading') return;
    void startRecording().then((res) => {
      if (res === 'fail') setPillKey((k) => k + 1); // our mic/key check failed — reset pill to idle
    });
  }

  /** Voice pill released (practice mode). */
  function handlePillStop(reason: string) {
    if (reason === 'cancel') {
      cancelRecording();
      return;
    }
    if (reason === 'unmount' || reason === 'disabled') return;
    if (reason === 'mic-denied') {
      // our own getUserMedia in startRecording already reported the error;
      // make sure the pill doesn't stay open if we never started.
      if (phase !== 'recording') {
        setError('Không truy cập được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại.');
        setPillKey((k) => k + 1);
      }
      return;
    }
    // tap / release / key / escape / blur -> stop and score
    if (phase === 'recording') {
      stopRecording();
      return;
    }
    // A stop arrived while recording was still starting (getUserMedia
    // pending): cancel the pending start so the recording never begins.
    if (phase === 'ready') {
      pendingCancelRef.current = true;
    }
  }

  const pillColors = isDark
    ? { background: '#f4f0e8', accentColor: '#1c1917', iconColor: 'rgba(28,25,23,0.55)' }
    : { background: '#1c1917', accentColor: '#faf9f7', iconColor: 'rgba(250,249,247,0.6)' };

  async function handleStopped() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
    if (cancelledRef.current) {
      // user slid the voice pill to cancel — discard the take silently
      cancelledRef.current = false;
      stoppingRef.current = false;
      chunksRef.current = [];
      setPhase('ready');
      return;
    }
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size === 0) {
      setError('Bản ghi âm trống. Hãy thử ghi âm lại.');
      setPhase('ready');
      stoppingRef.current = false;
      if (examMode) {
        examBlockedRef.current = true;
        onPartFinished?.(null);
      }
      return;
    }
    // Keep the take for playback in the result view (no server persistence).
    // The key gate already ran at recording start, so scoring is possible.
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    const url = URL.createObjectURL(blob);
    recordedUrlRef.current = url;
    setRecordedUrl(url);
    setPhase('uploading');
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');
    fd.append('part', String(part));
    fd.append('prompt', promptText);
    if (sessionMode) fd.append('mode', sessionMode);
    // BYOK: attach the user's own provider + key when saved. When absent, the
    // server falls back to its own OPENAI_API_KEY (if configured).
    const ai = getAiSettings();
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
      onPartFinished?.(data as ScoreResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chấm bài thất bại. Hãy thử lại.');
      setPhase('ready');
      if (examMode) {
        examBlockedRef.current = true;
        onPartFinished?.(null);
      }
    }
    stoppingRef.current = false;
  }

  const ai = getAiSettings();
  const noKeyConfigured = serverKey === false && !ai.apiKey;
  /** Server-key config still loading and no BYOK key: don't know yet whether
   * scoring is possible — disable recording until it resolves. */
  const keyLoading = !ai.apiKey && serverKey === null;

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
      {phase === 'ready' && examMode && (
        <p style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 9 }} aria-live="polite">
          <span className="rec-dot" />
          Đang mở micro…
        </p>
      )}
      {!examMode && (phase === 'ready' || phase === 'recording') && (
        <div className="card-soft" style={{ textAlign: 'center' }}>
          {phase === 'recording' ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span className="rec-dot" /> Đang ghi âm — còn {fmt(talkLeft)}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Sẵn sàng — nhấn nút micro để bắt đầu nói (tối đa {fmt(talkSec)})
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 4px' }}>
            <VoicePill
              key={pillKey}
              size={46}
              background={pillColors.background}
              accentColor={pillColors.accentColor}
              iconColor={pillColors.iconColor}
              reactive="mic"
              showTime
              waveform
              slideToCancel
              disabled={keyLoading}
              externalStream={streamRef.current}
              useExternalStream
              ariaLabel="Ghi âm bài nói"
              onStart={handlePillStart}
              onStop={({ reason }) => handlePillStop(reason)}
            />
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '8px 0 0' }}>
            {phase === 'recording'
              ? 'Bấm lần nữa để dừng & chấm điểm · kéo sang trái để hủy bản ghi'
              : 'Bấm 1 lần để bắt đầu, bấm lại để dừng · kéo sang trái để hủy'}
          </p>
          {keyLoading && (
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '8px 0 0' }} aria-live="polite">
              Đang kiểm tra cấu hình AI…
            </p>
          )}
          {phase === 'ready' && (
            <div className="btn-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn" onClick={startPrep}>
                <ArrowPathIcon width={16} height={16} />
                Chuẩn bị lại
              </button>
            </div>
          )}
        </div>
      )}
      {phase === 'recording' && examMode && (
        <div className="card-soft" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span className="rec-dot" /> Đang ghi âm — còn {fmt(talkLeft)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 4px' }}>
            <VoicePill
              key={pillKey}
              size={46}
              background={pillColors.background}
              accentColor={pillColors.accentColor}
              iconColor={pillColors.iconColor}
              reactive="mic"
              showTime
              waveform
              slideToCancel={false}
              autoBeginSignal={autoBegin}
              externalStream={streamRef.current}
              useExternalStream
              ariaLabel="Ghi âm bài nói"
              onStart={handlePillStart}
              onStop={({ reason }) => handlePillStop(reason)}
            />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--faint)', margin: '8px 0 0' }}>
            Nhấn để dừng & nộp bài sớm
          </p>
        </div>
      )}
      {phase === 'uploading' && (
        <div style={{ color: 'var(--muted)' }}>
          <LatticeLoader status="working" label="AI đang nghe và chấm bài" showTimer fontSize={13} />
        </div>
      )}
      {error && (
        <p role="alert" style={{ color: 'var(--wrong)', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <ExclamationTriangleIcon width={18} height={18} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </p>
      )}
      {phase === 'done' && result && (
        examMode ? (
          <div className="card-soft" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircleIcon width={22} height={22} style={{ color: 'var(--correct)', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              Đã hoàn thành Part {part} — AI đã chấm xong, điểm chi tiết sẽ hiện ở cuối bài thi.
            </p>
          </div>
        ) : (
          <>
            <ScoreCard result={result} audioUrl={recordedUrl} />
            {result.persisted === false && (
              <p style={{ fontSize: '0.85rem', color: 'var(--wrong)', margin: '10px 0 0' }}>
                Đã chấm điểm nhưng chưa lưu được vào tiến độ (lỗi kết nối). Bài ghi âm này sẽ không hiện ở trang Tiến độ.
              </p>
            )}
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
        )
      )}
    </div>
  );
}

function ScoreCard({ result, audioUrl }: { result: ScoreResult; audioUrl?: string | null }) {
  return (
    <div className="card-soft">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="icon-badge">
          <CheckCircleIcon width={24} height={24} />
        </span>
        <div>
          <strong style={{ fontSize: '2rem', fontWeight: 800 }}>
            <CountUp to={Math.round(result.overall * 10) / 10} locales="vi-VN" duration={1.4} />
          </strong>
          <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>/ 10 · điểm tổng</span>
        </div>
      </div>
      {audioUrl && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: '0.88rem', fontWeight: 600, margin: '0 0 6px' }}>
            Nghe lại bản ghi của bạn
          </p>
          <audio controls src={audioUrl} style={{ width: '100%' }} />
        </div>
      )}
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {SPEAKING_CRITERIA.map((c, i) => {
          const v = result.scores?.[c.key] ?? 0;
          return (
            <div key={c.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', gap: 8 }}>
                <span>
                  <strong>{c.label}</strong>{' '}
                  <span style={{ color: 'var(--muted)' }}>· {c.vi}</span>
                </span>
                <strong><CountUp to={v} locales="vi-VN" duration={1} delay={i * 0.08} /></strong>
              </div>
              <div className="score-bar" style={{ marginTop: 5 }}>
                <div style={{ width: `${v * 10}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 12 }}>
        <strong>Lưu ý:</strong> điểm Phát âm của AI chỉ mang tính tương đối vì AI không nghe trực tiếp
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
  examMode?: boolean;
  onPartFinished?: (result: ScoreResult | null) => void;
  onScoringStateChange?: (scoring: boolean) => void;
  /** 'practice' | 'mock' — stored with the session for history */
  sessionMode?: string;
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
