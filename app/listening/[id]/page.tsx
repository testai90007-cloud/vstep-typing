'use client';

// Listening test player: /listening/[id]
// Flow: listen per recording → answer A/B/C/D → timer → submit → auto-score → review.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeftIcon,
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'skipped'>('idle');
  const submittedRef = useRef(false);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (test) {
      setTimeLeft(test.durationMin * 60);
      startRef.current = Date.now();
    }
  }, [test]);

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

  // Save result once after submit (logged-in users only).
  useEffect(() => {
    if (!submitted || !test || saveState !== 'idle') return;
    if (!session?.user) {
      setSaveState('skipped');
      return;
    }
    setSaveState('saving');
    const score = questions.filter((q) => answers[q.num] === q.answer).length;
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    fetch('/api/listening/save', {
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
    })
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('skipped'));
  }, [submitted, test, session, saveState, questions, answers, total, mode]);

  const scrollToQ = (num: number) => {
    document.getElementById(`q-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const paletteButtons = (className: string, style?: React.CSSProperties) => (
    <div className={className} style={style}>
      {questions.map((q) => {
        const done = answers[q.num] != null;
        return (
          <button
            key={q.num}
            className={`palette-btn${done ? ' done' : ''}`}
            onClick={() => scrollToQ(q.num)}
            title={`Câu ${q.num}${done ? ' (đã trả lời)' : ''}`}
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
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{pct}% câu đúng</p>
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
          </p>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>
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
                <audio controls src={rec.audio} style={{ width: '100%' }} preload="none" />
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
                    {rec.script}
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
        style={{
          position: 'sticky',
          top: 57,
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
            {mode === 'mock' ? `Nộp bài (${answeredCount}/${total})` : `Hoàn thành (${answeredCount}/${total})`}
          </button>
        </div>
        {/* Question palette — in the top bar on mobile, sidebar on desktop */}
        {paletteButtons('palette palette-inbar', { marginTop: 10 })}
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
              <audio controls src={rec.audio} style={{ width: '100%' }} preload="none" />
              {rec.questions.map((q, qi) => {
                const num = numOf.get(`${rec.id}:${qi}`) ?? 0;
                const chosen = answers[num];
                const correct = chosen === q.answer;
                return (
                  <div key={num} id={`q-${num}`} style={{ marginTop: 14, scrollMarginTop: 210 }}>
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
              {mode === 'practice' && (
                <details style={{ marginTop: 10 }} open={recChecked || undefined}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                    Transcript
                  </summary>
                  <p className="reference" style={{ fontSize: '0.95rem', marginTop: 8 }}>
                    {rec.script}
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
          Đã trả lời {answeredCount}/{total} câu
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
              <span>{answeredCount}/{total} đã trả lời</span>
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
