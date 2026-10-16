'use client';

// Listening test player: /listening/[id]
// Flow: listen per recording → answer A/B/C/D → timer → submit → auto-score → review.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BookOpenIcon,
  ClockIcon,
  CheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  FlagIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import { getListeningTest, flattenQuestions, scoreParts } from '@/lib/listening';

const LETTERS = ['A', 'B', 'C', 'D'];

function fmtTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Strip the trailing "Nguồn: <url>" attribution line from a transcript at render time. */
function stripSource(script: string): string {
  return script.replace(/\s*Nguồn:\s*\S+\s*$/, '');
}

/**
 * Audio player with load-failure handling and (mock mode) replay limiting.
 * On a load error it shows a clear message + retry instead of a dead player.
 * In mock mode `blockSeekBack` clamps seeking to the furthest point already
 * reached, so scrubbing back to re-listen inside the single allowed play
 * is not possible (seeking forward stays allowed).
 */
function ListeningAudio({
  src,
  exhausted,
  onEnded,
  blockSeekBack,
}: {
  src: string;
  /** mock mode: this recording already had its one full play — replay blocked */
  exhausted?: boolean;
  onEnded?: () => void;
  /** mock mode: forbid seeking back before the furthest point reached */
  blockSeekBack?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** furthest playback position reached (seconds) — the seek-back floor */
  const maxReachedRef = useRef(0);
  if (exhausted) {
    return (
      <p style={{ margin: '8px 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
        Đã nghe 1 lần — chế độ Thi thử chỉ cho nghe mỗi đoạn 1 lần.
      </p>
    );
  }
  if (failed) {
    return (
      <div className="card-soft" style={{ padding: '12px 14px' }}>
        <p style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
          Không tải được file nghe. Kiểm tra kết nối mạng rồi thử lại.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setFailed(false);
            maxReachedRef.current = 0;
            setRetryKey((k) => k + 1);
          }}
        >
          Thử tải lại
        </button>
      </div>
    );
  }
  return (
    <audio
      ref={audioRef}
      key={retryKey}
      controls
      src={src}
      style={{ width: '100%' }}
      preload="metadata"
      onError={() => setFailed(true)}
      onEnded={onEnded}
      onTimeUpdate={() => {
        const el = audioRef.current;
        if (el) maxReachedRef.current = Math.max(maxReachedRef.current, el.currentTime);
      }}
      onSeeked={() => {
        const el = audioRef.current;
        if (blockSeekBack && el && el.currentTime < maxReachedRef.current - 0.5) {
          el.currentTime = maxReachedRef.current;
        } else if (el) {
          maxReachedRef.current = Math.max(maxReachedRef.current, el.currentTime);
        }
      }}
    />
  );
}

export default function ListeningPlayerPage() {
  const params = useParams();
  const { data: session } = useSession();
  const test = useMemo(
    () => getListeningTest(typeof params.id === 'string' ? params.id : ''),
    [params.id]
  );
  const questions = useMemo(() => (test ? flattenQuestions(test) : []), [test]);
  // Map "recId:questionIndexWithinRecording" -> global question number.
  const numOf = useMemo(() => {
    const m = new Map<string, number>();
    if (test) {
      let num = 0;
      for (const part of test.parts) {
        for (const rec of part.recordings) {
          rec.questions.forEach((_, qi) => {
            num += 1;
            m.set(`${rec.id}:${qi}`, num);
          });
        }
      }
    }
    return m;
  }, [test]);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<'pick' | 'practice' | 'mock'>('pick');
  /** practice mode: recordings whose answers were checked immediately */
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'skipped' | 'error'>('idle');
  /** mock mode: completed plays per recording id (1 full play = replay blocked) */
  const [plays, setPlays] = useState<Record<string, number>>({});
  /** mobile sticky bar: question palette collapsed by default (35 buttons) */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const submittedRef = useRef(false);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (test) {
      setTimeLeft(test.durationMin * 60);
    }
  }, [test]);

  // Start the recorded duration when the user picks a mode (not on page mount,
  // so idle time on the mode-picker screen doesn't inflate the duration).
  useEffect(() => {
    if (mode !== 'pick') {
      startRef.current = Date.now();
    }
  }, [mode]);

  // Warn before leaving mid-test (answers live in memory until submit).
  useEffect(() => {
    if (mode === 'pick' || submitted) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [mode, submitted]);

  const handleAudioEnded = useCallback(
    (recId: string) => {
      if (mode !== 'mock') return;
      setPlays((p) => ({ ...p, [recId]: (p[recId] ?? 0) + 1 }));
    },
    [mode]
  );

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
  }, []);

  useEffect(() => {
    if (!test || submitted || mode !== 'mock') return;
    if (timeLeft <= 0) {
      doSubmit();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, submitted, test, doSubmit, mode]);

  const answeredCount = Object.keys(answers).length;
  const total = questions.length;

  /** Clear the in-progress attempt (answers, checks, plays) for a retry or
   * a mode change — the result already saved (if any) is untouched. */
  const resetAttemptState = useCallback(() => {
    setAnswers({});
    setChecked({});
    setPlays({});
    setSubmitted(false);
    submittedRef.current = false;
    setSaveState('idle');
    if (test) setTimeLeft(test.durationMin * 60);
    startRef.current = Date.now();
  }, [test]);

  /** Back to the mode picker. Asks first when answers would be discarded. */
  const changeMode = useCallback(() => {
    if (!submitted && answeredCount > 0) {
      const ok = window.confirm('Đổi chế độ sẽ xóa bài làm hiện tại. Tiếp tục?');
      if (!ok) return;
    }
    resetAttemptState();
    setMode('pick');
  }, [submitted, answeredCount, resetAttemptState]);

  const handleSubmit = () => {
    const missing = total - answeredCount;
    if (missing > 0) {
      const ok = window.confirm(
        `Bạn còn ${missing} câu chưa trả lời. Nộp bài ngay?`
      );
      if (!ok) return;
    }
    doSubmit();
  };

  // Persist the result. The server response is checked honestly: only an
  // actual OK + saved:true counts as "saved". A 401 means the login didn't
  // reach the server (skipped); anything else is a real failure with retry.
  const doSave = useCallback(async () => {
    if (!test) return;
    if (!session?.user) {
      setSaveState('skipped');
      return;
    }
    setSaveState('saving');
    const score = questions.filter((q) => answers[q.num] === q.answer).length;
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    try {
      const res = await fetch('/api/listening/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: test.id,
          score,
          total,
          durationSec,
          answers,
          mode,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setSaveState('skipped');
        return;
      }
      if (res.ok && data?.saved !== false) {
        setSaveState('saved');
        return;
      }
      setSaveState('error');
    } catch {
      setSaveState('error');
    }
  }, [test, session, questions, answers, total, mode]);

  // Save result once after submit (logged-in users only).
  useEffect(() => {
    if (!submitted || !test || saveState !== 'idle') return;
    doSave();
  }, [submitted, test, saveState, doSave]);

  const scrollToQ = (num: number) => {
    document.getElementById(`q-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const paletteButtons = (className: string, style?: React.CSSProperties, id?: string) => (
    <div className={className} style={style} id={id}>
      {questions.map((q) => {
        const done = answers[q.num] != null;
        return (
          <button
            key={q.num}
            className={`palette-btn${done ? ' done' : ''}`}
            onClick={() => scrollToQ(q.num)}
            title={`Câu ${q.num}${done ? ' (đã trả lời)' : ''}`}
            aria-label={`Câu ${q.num}${done ? ' (đã trả lời)' : ''}`}
          >
            {q.num}
          </button>
        );
      })}
    </div>
  );

  if (!test) {
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/listening" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
        </div>
        <p>Không tìm thấy đề này.</p>
      </main>
    );
  }

  if (submitted) {
    const score = questions.filter((q) => answers[q.num] === q.answer).length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const parts = scoreParts(test, answers);
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/listening" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
          <button type="button" className="back" onClick={changeMode} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>
            Đổi chế độ
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <span className="icon-badge" style={{ margin: '0 auto 10px' }}>
            <CheckCircleIcon width={26} height={26} />
          </span>
          <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: '0.9rem' }}>Kết quả</p>
          <p style={{ margin: 0, fontSize: '2.6rem', fontWeight: 800 }}>
            {score}
            <span style={{ color: 'var(--muted)', fontSize: '1.4rem' }}>/{total}</span>
          </p>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}><span>{pct}%</span> câu đúng</p>
          <div style={{ maxWidth: 340, margin: '18px auto 0', textAlign: 'left' }}>
            {parts.map((p) => (
              <div key={p.part} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span>Part {p.part}</span>
                  <span style={{ color: 'var(--muted)' }}>
                    {p.correct}/{p.total}
                  </span>
                </div>
                <div className="score-bar">
                  <div style={{ width: p.total > 0 ? `${(p.correct / p.total) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '14px 0 0' }}>
            {saveState === 'saved' && 'Đã lưu vào tiến bộ của bạn.'}
            {saveState === 'saving' && 'Đang lưu…'}
            {saveState === 'skipped' && 'Đăng nhập bằng Google để lưu kết quả.'}
            {saveState === 'error' && (
              <>
                Lưu thất bại.{' '}
                <button
                  type="button"
                  onClick={doSave}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontWeight: 700,
                    color: 'var(--accent-strong)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Thử lưu lại
                </button>
              </>
            )}
          </p>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button type="button" className="btn" onClick={resetAttemptState}>
              <ArrowPathIcon width={16} height={16} />
              Làm lại đề này
            </button>
            <Link href="/listening" className="btn" style={{ textDecoration: 'none' }}>
              Đề khác
            </Link>
            <Link href="/progress" className="btn" style={{ textDecoration: 'none' }}>
              <ChartBarIcon width={16} height={16} />
              Xem tiến bộ
            </Link>
          </div>
        </div>

        <h2 className="section-title">Xem lại bài làm</h2>
        {test.parts.map((part) => (
          <section key={part.n} style={{ marginTop: 18 }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              {part.title} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.85rem' }}>· {part.hint}</span>
            </h3>
            {part.recordings.map((rec) => (
              <div key={rec.id} className="card-soft" style={{ marginTop: 10 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SpeakerWaveIcon width={17} height={17} style={{ color: 'var(--muted)' }} />
                  {rec.label}
                </p>
                <ListeningAudio src={rec.audio} />
                {rec.questions.map((q, qi) => {
                  const num = numOf.get(`${rec.id}:${qi}`) ?? 0;
                  const chosen = answers[num];
                  const correct = chosen === q.answer;
                  return (
                    <div key={qi} style={{ marginTop: 12 }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                        <span style={{ color: 'var(--muted)' }}>{num}.</span>
                        <span style={{ flex: 1 }}>{q.q}</span>
                        <span
                          className="chip"
                          style={correct
                            ? { background: 'var(--correct-soft)', color: 'var(--correct)' }
                            : { background: 'var(--wrong-soft)', color: 'var(--wrong)' }}
                        >
                          {correct
                            ? <><CheckCircleIcon width={12} height={12} /> Đúng</>
                            : <><XCircleIcon width={12} height={12} /> Sai</>}
                        </span>
                      </p>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {q.options.map((opt, oi) => {
                          const isAnswer = oi === q.answer;
                          const isChosen = oi === chosen;
                          const cls = `opt-card${isAnswer ? ' correct' : ''}${!isAnswer && isChosen ? ' wrong-pick' : ''}`;
                          return (
                            <div key={oi} className={cls} style={{ cursor: 'default' }}>
                              <span className="letter">{LETTERS[oi]}</span>
                              <span>{opt}</span>
                              {isAnswer && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--correct)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <CheckIcon width={13} height={13} />
                                  đáp án đúng
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                    Transcript
                  </summary>
                  <p className="reference" style={{ fontSize: '0.95rem', marginTop: 8 }}>
                    {stripSource(rec.script)}
                  </p>
                </details>
              </div>
            ))}
          </section>
        ))}
      </main>
    );
  }

  if (mode === 'pick') {
    return (
      <main className="page">
        <div className="nav-top">
          <Link href="/listening" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
        </div>
        <h1 className="brand" style={{ fontSize: '1.9rem' }}>
          {test.title} <span className="hl">· Listening</span>
        </h1>
        <p className="lead">
          {total} câu hỏi · {test.parts.length} parts · {test.durationMin} phút như thi thật.
        </p>
        <div className="mode-cards">
          <button className="card lift mode-card" onClick={() => setMode('practice')}>
            <span className="icon-badge">
              <BookOpenIcon width={24} height={24} strokeWidth={1.6} />
            </span>
            <strong>Luyện tập</strong>
            <span className="chip">Nghe từng bài thoải mái</span>
            <p>
              Trả lời từng bài nghe rồi bấm Kiểm tra để xem đúng/sai và transcript ngay.
              Nghe lại bao nhiêu lần cũng được.
            </p>
          </button>
          <button className="card lift mode-card" onClick={() => setMode('mock')}>
            <span className="icon-badge">
              <FlagIcon width={24} height={24} strokeWidth={1.6} />
            </span>
            <strong>Thi thử</strong>
            <span className="chip accent">Đúng {test.durationMin} phút như thi thật</span>
            <p>
              Làm cả đề một mạch, hết giờ tự động nộp — không xem đáp án hay transcript
              trước khi nộp bài.
            </p>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div
        className="sticky-player-bar"
        style={{
          position: 'sticky',
          zIndex: 20,
          background: 'var(--bg)',
          padding: '10px 0',
          borderBottom: '1px solid var(--line)',
          marginBottom: 18,
        }}
      >
        <div className="nav-top" style={{ marginBottom: 8 }}>
          <Link href="/listening" className="back">
            <ArrowLeftIcon width={16} height={16} />
            Danh sách đề
          </Link>
          <button type="button" className="back" onClick={changeMode} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>
            Đổi chế độ
          </button>
          {mode === 'mock' && (
            <span className={`timer-pill${timeLeft < 60 ? ' danger' : ''}`}>
              <ClockIcon width={17} height={17} />
              {fmtTime(timeLeft)}
            </span>
          )}
          {mode === 'practice' && (
            <span className="chip">Luyện tập</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: '1.1rem', fontWeight: 800 }}>{test.title}</strong>
          <button className="btn primary" onClick={handleSubmit}>
            <CheckIcon width={16} height={16} />
            {mode === 'mock' ? <>Nộp bài (<span>{answeredCount}/{total}</span>)</> : <>Hoàn thành (<span>{answeredCount}/{total}</span>)</>}
          </button>
        </div>
        {/* Question palette — collapsed behind a toggle in the top bar on
         * mobile (35 buttons would eat a third of the screen); the sidebar
         * palette on desktop stays fully visible. The wrapper reuses
         * .palette-inbar so the toggle only appears where that palette does
         * (mobile), without touching the shared stylesheet. */}
        <div className="palette-inbar" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <button
            type="button"
            className="btn"
            aria-expanded={paletteOpen}
            aria-controls="listen-palette-inbar"
            onClick={() => setPaletteOpen((o) => !o)}
            style={{ marginTop: 10 }}
          >
            {paletteOpen ? 'Thu gọn bảng câu hỏi' : <>Hiện bảng câu hỏi (<span>{answeredCount}/{total}</span>)</>}
          </button>
          {paletteOpen && paletteButtons('palette palette-inbar', { marginTop: 10 }, 'listen-palette-inbar')}
        </div>
      </div>

      <div className="listen-layout">
        <div className="listen-main">

      {test.parts.map((part) => (
        <section key={part.n} style={{ marginBottom: 26 }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.2rem' }}>
            {part.title}
            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>
              {part.hint}
            </span>
          </h2>
          {part.recordings.map((rec) => {
            const recChecked = mode === 'practice' && !!checked[rec.id];
            return (
            <div key={rec.id} className="card" style={{ marginTop: 12, padding: '18px 20px' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <SpeakerWaveIcon width={17} height={17} style={{ color: 'var(--muted)' }} />
                {rec.label}
              </p>
              <ListeningAudio
                src={rec.audio}
                exhausted={mode === 'mock' && (plays[rec.id] ?? 0) >= 1}
                onEnded={() => handleAudioEnded(rec.id)}
                blockSeekBack={mode === 'mock'}
              />
              {rec.questions.map((q, qi) => {
                const num = numOf.get(`${rec.id}:${qi}`) ?? 0;
                const chosen = answers[num];
                const correct = chosen === q.answer;
                return (
                  <div key={num} id={`q-${num}`} style={{ marginTop: 14, scrollMarginTop: 320 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <span style={{ color: 'var(--accent-strong)', flexShrink: 0 }}>{num}.</span>
                      <span style={{ flex: 1 }}>{q.q}</span>
                      {recChecked && (
                        <span
                          className="chip"
                          style={correct
                            ? { background: 'var(--correct-soft)', color: 'var(--correct)' }
                            : { background: 'var(--wrong-soft)', color: 'var(--wrong)' }}
                        >
                          {correct
                            ? <><CheckCircleIcon width={12} height={12} /> Đúng</>
                            : <><XCircleIcon width={12} height={12} /> Sai</>}
                        </span>
                      )}
                    </p>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {q.options.map((opt, oi) => {
                        if (recChecked) {
                          const isAnswer = oi === q.answer;
                          const isChosen = oi === chosen;
                          const cls = `opt-card${isAnswer ? ' correct' : ''}${!isAnswer && isChosen ? ' wrong-pick' : ''}`;
                          return (
                            <div key={oi} className={cls} style={{ cursor: 'default' }}>
                              <span className="letter">{LETTERS[oi]}</span>
                              <span>{opt}</span>
                              {isAnswer && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--correct)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <CheckIcon width={13} height={13} />
                                  đáp án đúng
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <button
                            key={oi}
                            className={`opt-card${chosen === oi ? ' selected' : ''}`}
                            onClick={() => setAnswers((a) => ({ ...a, [num]: oi }))}
                          >
                            <span className="letter">{LETTERS[oi]}</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {mode === 'practice' && !recChecked && (
                <button
                  className="btn"
                  style={{ marginTop: 14 }}
                  onClick={() => setChecked((c) => ({ ...c, [rec.id]: true }))}
                >
                  <CheckIcon width={16} height={16} />
                  Kiểm tra bài này
                </button>
              )}
              {mode === 'practice' && recChecked && (
                <button
                  className="btn"
                  style={{ marginTop: 14 }}
                  onClick={() => {
                    setChecked((c) => ({ ...c, [rec.id]: false }));
                    setAnswers((a) => {
                      const next = { ...a };
                      rec.questions.forEach((_, qi) => {
                        const num = numOf.get(`${rec.id}:${qi}`);
                        if (num != null) delete next[num];
                      });
                      return next;
                    });
                  }}
                >
                  <ArrowPathIcon width={16} height={16} />
                  Làm lại bài này
                </button>
              )}
              {mode === 'practice' && (
                <details style={{ marginTop: 10 }} open={recChecked || undefined}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                    Transcript
                  </summary>
                  <p className="reference" style={{ fontSize: '0.95rem', marginTop: 8 }}>
                    {stripSource(rec.script)}
                  </p>
                </details>
              )}
            </div>
            );
          })}
        </section>
      ))}

      <div className="card" style={{ textAlign: 'center', marginTop: 8 }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 12px' }}>
          Đã trả lời <span>{answeredCount}/{total}</span> câu
        </p>
        <button className="btn primary" onClick={handleSubmit} style={{ fontSize: '1rem', padding: '12px 28px' }}>
          <CheckIcon width={18} height={18} />
          {mode === 'mock' ? 'Nộp bài và chấm điểm' : 'Hoàn thành & xem kết quả'}
        </button>
      </div>
        </div>
        <aside className="listen-side">
          <div className="card">
            <div className="listen-side-head">
              <strong>Câu hỏi</strong>
              <span><span>{answeredCount}/{total}</span> đã trả lời</span>
            </div>
            {paletteButtons('palette palette-vertical')}
            <button className="btn primary" onClick={handleSubmit} style={{ width: '100%', marginTop: 14 }}>
              <CheckIcon width={16} height={16} />
              {mode === 'mock' ? 'Nộp bài' : 'Hoàn thành'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
